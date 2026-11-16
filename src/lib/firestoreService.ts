import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, handleFirestoreError, OperationType, storage } from './firebase';
import type {
  AnimeItem,
  CommunitySettings,
  EpisodeItem,
  UserPrivateInfo,
  UserProfile,
  WatchlistEntry,
  WatchProgressEntry,
} from './types';

function tsToIso(val: unknown): string {
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (typeof val === 'string') return val;
  return new Date().toISOString();
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const path = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      uid: d.uid,
      username: d.username,
      displayName: d.displayName,
      avatarUrl: d.avatarUrl || '',
      bannerUrl: d.bannerUrl || '',
      frameId: d.frameId || 'ember-ring',
      themeId: d.themeId || 'classic-orange',
      bio: d.bio || '',
      favoriteGenres: Array.isArray(d.favoriteGenres) ? d.favoriteGenres : [],
      badges: Array.isArray(d.badges) ? d.badges : [],
      watchlistVisibility: d.watchlistVisibility === 'private' ? 'private' : 'public',
      setupCompleted: Boolean(d.setupCompleted),
      joinDate: tsToIso(d.joinDate),
      updatedAt: tsToIso(d.updatedAt),
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

export async function getUserProfileByUsername(username: string): Promise<UserProfile | null> {
  const normalized = username.trim().toLowerCase();
  const path = `usernames/${normalized}`;
  try {
    const uSnap = await getDoc(doc(db, 'usernames', normalized));
    if (!uSnap.exists()) return null;
    const uid = uSnap.data()?.uid as string;
    if (!uid) return null;
    return await getUserProfile(uid);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

export async function checkUsernameAvailable(username: string, currentUid?: string): Promise<boolean> {
  const normalized = username.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,30}$/.test(normalized)) return false;
  const path = `usernames/${normalized}`;
  try {
    const snap = await getDoc(doc(db, 'usernames', normalized));
    if (!snap.exists()) return true;
    return Boolean(currentUid && snap.data()?.uid === currentUid);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

export async function getUserPrivateInfo(uid: string): Promise<UserPrivateInfo | null> {
  const path = `users/${uid}/private/info`;
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'private', 'info'));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      uid: d.uid,
      email: d.email,
      preferredLanguage: d.preferredLanguage || 'Japanese',
      preferredSubtitleLang: d.preferredSubtitleLang || 'en',
      skipIntroEnabled: d.skipIntroEnabled !== false,
      updatedAt: tsToIso(d.updatedAt),
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

export async function ensureInitialUserDocuments(uid: string, email: string, displayName: string): Promise<void> {
  const defaultUsername = `user_${uid.slice(0, 10).toLowerCase().replace(/[^a-z0-9_]/g, '')}`;
  const profileRef = doc(db, 'users', uid);
  const privateRef = doc(db, 'users', uid, 'private', 'info');

  try {
    const profileSnap = await getDoc(profileRef);
    if (!profileSnap.exists()) {
      await setDoc(profileRef, {
        uid,
        username: defaultUsername,
        displayName: (displayName || 'AniMayX Member').slice(0, 60),
        avatarUrl: '/src/assets/images/avatar_preset_kitsune_1794795105188.jpg',
        bannerUrl: '/src/assets/images/banner_ember_horizon_1794795105184.jpg',
        frameId: 'ember-ring',
        themeId: 'classic-orange',
        bio: '',
        favoriteGenres: [],
        badges: [],
        watchlistVisibility: 'public',
        setupCompleted: false,
        joinDate: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    const privateSnap = await getDoc(privateRef);
    if (!privateSnap.exists()) {
      await setDoc(privateRef, {
        uid,
        email: email.slice(0, 254),
        preferredLanguage: 'Japanese',
        preferredSubtitleLang: 'en',
        skipIntroEnabled: true,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${uid}`);
  }
}

export async function saveProfileWithAtomicUsername(
  uid: string,
  previousUsername: string | null,
  payload: {
    username: string;
    displayName: string;
    avatarUrl: string;
    bannerUrl: string;
    frameId: string;
    themeId: UserProfile['themeId'];
    bio: string;
    favoriteGenres: string[];
    watchlistVisibility: 'public' | 'private';
    setupCompleted: boolean;
  }
): Promise<void> {
  const newUsername = payload.username.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,30}$/.test(newUsername)) {
    throw new Error('Username must be 3-30 lowercase letters, numbers, or underscores.');
  }

  try {
    await runTransaction(db, async (tx) => {
      const profileRef = doc(db, 'users', uid);
      const profileSnap = await tx.get(profileRef);
      const newUsernameRef = doc(db, 'usernames', newUsername);
      const newUsernameSnap = await tx.get(newUsernameRef);

      if (newUsernameSnap.exists() && newUsernameSnap.data()?.uid !== uid) {
        throw new Error('Username is already reserved by another member.');
      }

      if (previousUsername && previousUsername !== newUsername && !previousUsername.startsWith('user_')) {
        const oldRef = doc(db, 'usernames', previousUsername);
        const oldSnap = await tx.get(oldRef);
        if (oldSnap.exists() && oldSnap.data()?.uid === uid) {
          tx.delete(oldRef);
        }
      }

      if (!newUsernameSnap.exists()) {
        tx.set(newUsernameRef, {
          uid,
          username: newUsername,
          createdAt: serverTimestamp(),
        });
      }

      const cleanPayload = {
        username: newUsername,
        displayName: payload.displayName.trim().slice(0, 60) || 'Member',
        avatarUrl: payload.avatarUrl.slice(0, 500),
        bannerUrl: payload.bannerUrl.slice(0, 500),
        frameId: payload.frameId,
        themeId: payload.themeId,
        bio: payload.bio.trim().slice(0, 400),
        favoriteGenres: payload.favoriteGenres.slice(0, 12),
        watchlistVisibility: payload.watchlistVisibility,
        setupCompleted: payload.setupCompleted,
        updatedAt: serverTimestamp(),
      };

      if (!profileSnap.exists()) {
        tx.set(profileRef, {
          uid,
          badges: [],
          joinDate: serverTimestamp(),
          ...cleanPayload,
        });
      } else {
        tx.update(profileRef, cleanPayload);
      }
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes('Username is already reserved')) {
      throw err;
    }
    handleFirestoreError(err, OperationType.WRITE, `users/${uid}`);
  }
}

export async function updateUserPrivatePreferences(
  uid: string,
  prefs: Partial<Pick<UserPrivateInfo, 'preferredLanguage' | 'preferredSubtitleLang' | 'skipIntroEnabled'>>
): Promise<void> {
  const path = `users/${uid}/private/info`;
  try {
    const ref = doc(db, 'users', uid, 'private', 'info');
    await setDoc(
      ref,
      {
        ...prefs,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function uploadUserAsset(uid: string, kind: 'avatars' | 'banners', file: File): Promise<string> {
  const allowedTypes = kind === 'avatars' ? ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] : ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Invalid image type. Use JPG, PNG, or WEBP.');
  }
  const maxBytes = kind === 'avatars' ? 2 * 1024 * 1024 : 4 * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error(`Image exceeds ${kind === 'avatars' ? '2MB' : '4MB'} size limit.`);
  }
  const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const storageRef = ref(storage, `users/${uid}/${kind}/${safeName}`);
  await uploadBytes(storageRef, file, { contentType: file.type });
  return getDownloadURL(storageRef);
}

export async function deleteUserAccountRecords(uid: string, username?: string): Promise<void> {
  try {
    const batch = writeBatch(db);
    if (username) {
      batch.delete(doc(db, 'usernames', username));
    }
    batch.delete(doc(db, 'users', uid, 'private', 'info'));
    batch.delete(doc(db, 'users', uid));

    const wlSnap = await getDocs(query(collection(db, 'userWatchlists'), where('userId', '==', uid)));
    wlSnap.forEach((d) => batch.delete(d.ref));

    const wpSnap = await getDocs(query(collection(db, 'watchProgress'), where('userId', '==', uid)));
    wpSnap.forEach((d) => batch.delete(d.ref));

    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `users/${uid}`);
  }
}

// ----------------------------------------------------------------------------
// Watchlist & Watch Progress
// ----------------------------------------------------------------------------
export async function getUserWatchlist(uid: string): Promise<WatchlistEntry[]> {
  const path = 'userWatchlists';
  try {
    const q = query(collection(db, 'userWatchlists'), where('userId', '==', uid));
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        userId: data.userId,
        mediaId: data.mediaId,
        category: data.category,
        title: data.title,
        posterUrl: data.posterUrl || '',
        watchStatus: data.watchStatus,
        isPublic: Boolean(data.isPublic),
        updatedAt: tsToIso(data.updatedAt),
      };
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function upsertWatchlistEntry(entry: Omit<WatchlistEntry, 'updatedAt'>): Promise<void> {
  const docId = `${entry.userId}_${entry.mediaId}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  const path = `userWatchlists/${docId}`;
  try {
    await setDoc(doc(db, 'userWatchlists', docId), {
      ...entry,
      title: entry.title.slice(0, 240),
      posterUrl: (entry.posterUrl || '').slice(0, 600),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function removeWatchlistEntry(uid: string, mediaId: string): Promise<void> {
  const docId = `${uid}_${mediaId}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  const path = `userWatchlists/${docId}`;
  try {
    await deleteDoc(doc(db, 'userWatchlists', docId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function getUserWatchProgress(uid: string): Promise<WatchProgressEntry[]> {
  const path = 'watchProgress';
  try {
    const q = query(collection(db, 'watchProgress'), where('userId', '==', uid), limit(30));
    const snap = await getDocs(q);
    const items = snap.docs.map((d) => {
      const data = d.data();
      return {
        userId: data.userId,
        animeId: data.animeId,
        animeTitle: data.animeTitle || '',
        posterUrl: data.posterUrl || '',
        episodeNumber: Number(data.episodeNumber || 1),
        positionSeconds: Number(data.positionSeconds || 0),
        durationSeconds: Number(data.durationSeconds || 0),
        completed: Boolean(data.completed),
        updatedAt: tsToIso(data.updatedAt),
      };
    });
    return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function saveWatchProgress(entry: Omit<WatchProgressEntry, 'updatedAt'>): Promise<void> {
  const docId = `${entry.userId}_${entry.animeId}_${entry.episodeNumber}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  const path = `watchProgress/${docId}`;
  try {
    await setDoc(doc(db, 'watchProgress', docId), {
      userId: entry.userId,
      animeId: entry.animeId,
      animeTitle: (entry.animeTitle || '').slice(0, 240),
      posterUrl: (entry.posterUrl || '').slice(0, 600),
      episodeNumber: entry.episodeNumber,
      positionSeconds: Math.max(0, Math.round(entry.positionSeconds)),
      durationSeconds: Math.max(0, Math.round(entry.durationSeconds)),
      completed: entry.completed,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

// ----------------------------------------------------------------------------
// Firestore Anime & Episodes (Admin-managed & Published)
// ----------------------------------------------------------------------------
export async function listPublishedFirestoreAnime(collectionName: 'anime' | 'animeMovies' = 'anime'): Promise<AnimeItem[]> {
  try {
    const q = query(collection(db, collectionName), where('status', '==', 'published'), limit(40));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as AnimeItem);
  } catch {
    return [];
  }
}

export async function listAdminFirestoreAnime(collectionName: 'anime' | 'animeMovies' = 'anime'): Promise<AnimeItem[]> {
  try {
    const q = query(collection(db, collectionName), limit(100));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as AnimeItem);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, collectionName);
  }
}

export async function getFirestoreAnimeById(animeId: string, collectionName: 'anime' | 'animeMovies' = 'anime'): Promise<AnimeItem | null> {
  try {
    const snap = await getDoc(doc(db, collectionName, animeId));
    return snap.exists() ? (snap.data() as AnimeItem) : null;
  } catch {
    return null;
  }
}

export async function saveAdminAnime(
  anime: AnimeItem,
  collectionName: 'anime' | 'animeMovies' = 'anime',
  actorUid?: string
): Promise<void> {
  const path = `${collectionName}/${anime.id}`;
  try {
    const refDoc = doc(db, collectionName, anime.id);
    const existing = await getDoc(refDoc);
    const payload = {
      id: anime.id,
      anilistId: anime.anilistId ?? null,
      malId: anime.malId ?? null,
      titleEnglish: (anime.titleEnglish || '').slice(0, 240),
      titleRomaji: anime.titleRomaji.slice(0, 240),
      titleNative: (anime.titleNative || '').slice(0, 240),
      synopsis: (anime.synopsis || '').slice(0, 4000),
      posterUrl: (anime.posterUrl || '').slice(0, 600),
      bannerUrl: (anime.bannerUrl || '').slice(0, 600),
      genres: (anime.genres || []).slice(0, 20),
      season: anime.season || '',
      seasonYear: anime.seasonYear || 0,
      format: anime.format || 'TV',
      episodeCount: anime.episodeCount || 0,
      averageScore: anime.averageScore || 0,
      popularity: anime.popularity || 0,
      trendingRank: anime.trendingRank || 0,
      languages: (anime.languages || ['Japanese']).slice(0, 20),
      status: anime.status,
      featured: Boolean(anime.featured),
      hasAuthorizedPlayback: Boolean(anime.hasAuthorizedPlayback),
      sourceProvider: anime.sourceProvider || 'manual',
      adminLockedFields: (anime.adminLockedFields || ['status', 'featured', 'synopsis', 'hasAuthorizedPlayback']).slice(0, 30),
      createdAt: existing.exists() ? existing.data().createdAt : serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(refDoc, payload);

    if (actorUid) {
      const logId = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      await setDoc(doc(db, 'adminAuditLogs', logId), {
        id: logId,
        actorUid,
        action: existing.exists() ? 'UPDATE_ANIME' : 'CREATE_ANIME',
        targetPath: path,
        createdAt: serverTimestamp(),
      }).catch(() => {});
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteAdminAnime(animeId: string, collectionName: 'anime' | 'animeMovies' = 'anime'): Promise<void> {
  const path = `${collectionName}/${animeId}`;
  try {
    await deleteDoc(doc(db, collectionName, animeId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function listEpisodesForAnime(animeId: string, includeDrafts = false): Promise<EpisodeItem[]> {
  const path = `anime/${animeId}/episodes`;
  try {
    const q = includeDrafts
      ? query(collection(db, 'anime', animeId, 'episodes'), orderBy('episodeNumber', 'asc'))
      : query(
          collection(db, 'anime', animeId, 'episodes'),
          where('status', '==', 'published'),
          orderBy('episodeNumber', 'asc')
        );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as EpisodeItem);
  } catch {
    return [];
  }
}

export async function saveAdminEpisode(animeId: string, episode: EpisodeItem): Promise<void> {
  const path = `anime/${animeId}/episodes/${episode.id}`;
  try {
    await setDoc(doc(db, 'anime', animeId, 'episodes', episode.id), {
      id: episode.id,
      animeId,
      seasonNumber: Number(episode.seasonNumber || 1),
      episodeNumber: Number(episode.episodeNumber || 1),
      title: episode.title.slice(0, 240),
      description: (episode.description || '').slice(0, 2000),
      durationSeconds: Number(episode.durationSeconds || 0),
      thumbnailUrl: (episode.thumbnailUrl || '').slice(0, 600),
      status: episode.status,
      playbackSources: (episode.playbackSources || []).slice(0, 16),
      subtitles: (episode.subtitles || []).slice(0, 24),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteAdminEpisode(animeId: string, episodeId: string): Promise<void> {
  const path = `anime/${animeId}/episodes/${episodeId}`;
  try {
    await deleteDoc(doc(db, 'anime', animeId, 'episodes', episodeId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

// ----------------------------------------------------------------------------
// Discord Community Settings
// ----------------------------------------------------------------------------
export async function getDiscordCommunitySettings(): Promise<CommunitySettings | null> {
  try {
    const snap = await getDoc(doc(db, 'communitySettings', 'discord'));
    if (!snap.exists()) return null;
    return snap.data() as CommunitySettings;
  } catch {
    return null;
  }
}

export async function saveDiscordCommunitySettings(settings: Omit<CommunitySettings, 'id' | 'updatedAt'>, actorUid: string): Promise<void> {
  const path = 'communitySettings/discord';
  try {
    await setDoc(doc(db, 'communitySettings', 'discord'), {
      id: 'discord',
      serverName: settings.serverName.slice(0, 100),
      description: (settings.description || '').slice(0, 400),
      inviteUrl: settings.inviteUrl || '',
      iconUrl: (settings.iconUrl || '').slice(0, 500),
      supportInviteUrl: settings.supportInviteUrl || '',
      announcementsInviteUrl: settings.announcementsInviteUrl || '',
      showInHeader: Boolean(settings.showInHeader),
      showHomeCard: Boolean(settings.showHomeCard),
      showFooter: Boolean(settings.showFooter),
      showFloatingButton: Boolean(settings.showFloatingButton),
      enabled: Boolean(settings.enabled),
      updatedAt: serverTimestamp(),
    });

    const logId = `audit_${Date.now()}`;
    await setDoc(doc(db, 'adminAuditLogs', logId), {
      id: logId,
      actorUid,
      action: 'UPDATE_COMMUNITY_SETTINGS',
      targetPath: path,
      createdAt: serverTimestamp(),
    }).catch(() => {});
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}
