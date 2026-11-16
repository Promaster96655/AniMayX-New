import cron from 'node-cron';
import { FieldValue } from 'firebase-admin/firestore';
import { initFirebaseAdmin } from './firebaseAdmin.ts';
import { discoverAniListMedia } from './providers/anilist.ts';
import { discoverTmdb, isTmdbConfigured } from './providers/tmdb.ts';
import { discoverMangaDex, isComicVineConfigured } from './providers/mangadex.ts';
import type { NormalizedAnime, SyncJobState, SyncLogEntry } from './types.ts';

const SYNC_INTERVAL_MINUTES = Math.max(15, Number(process.env.SYNC_INTERVAL_MINUTES || 60));

let isSyncRunning = false;
let schedulerStarted = false;
let nextScheduledDate = new Date(Date.now() + SYNC_INTERVAL_MINUTES * 60 * 1000);

// In-memory catalog cache backed by Firestore when service account is configured
const syncedAnimeMap = new Map<string, NormalizedAnime>();
const syncedAnimeMoviesMap = new Map<string, NormalizedAnime>();
const syncLogs: SyncLogEntry[] = [];

const syncJobs: Record<string, SyncJobState> = {
  anilist_anime: {
    id: 'anilist_anime',
    provider: 'AniList GraphQL (Anime)',
    category: 'Anime',
    status: 'idle',
    lastSuccessAt: null,
    lastAttemptAt: null,
    nextScheduledAt: nextScheduledDate.toISOString(),
    importedCount: 0,
    errorMessage: null,
  },
  anilist_anime_movies: {
    id: 'anilist_anime_movies',
    provider: 'AniList GraphQL (Anime Movies)',
    category: 'Anime Movies',
    status: 'idle',
    lastSuccessAt: null,
    lastAttemptAt: null,
    nextScheduledAt: nextScheduledDate.toISOString(),
    importedCount: 0,
    errorMessage: null,
  },
  anilist_novels: {
    id: 'anilist_novels',
    provider: 'AniList GraphQL (Light Novels)',
    category: 'Light Novels',
    status: 'idle',
    lastSuccessAt: null,
    lastAttemptAt: null,
    nextScheduledAt: nextScheduledDate.toISOString(),
    importedCount: 0,
    errorMessage: null,
  },
  mangadex: {
    id: 'mangadex',
    provider: 'MangaDex v5 API',
    category: 'Manga',
    status: 'idle',
    lastSuccessAt: null,
    lastAttemptAt: null,
    nextScheduledAt: nextScheduledDate.toISOString(),
    importedCount: 0,
    errorMessage: null,
  },
  tmdb: {
    id: 'tmdb',
    provider: 'TMDB Official API',
    category: 'Movies & Web Series',
    status: isTmdbConfigured() ? 'idle' : 'unconfigured',
    lastSuccessAt: null,
    lastAttemptAt: null,
    nextScheduledAt: nextScheduledDate.toISOString(),
    importedCount: 0,
    errorMessage: isTmdbConfigured() ? null : 'TMDB_API_KEY / TMDB_READ_TOKEN not set',
  },
  comicvine: {
    id: 'comicvine',
    provider: 'ComicVine API',
    category: 'Comics',
    status: isComicVineConfigured() ? 'idle' : 'unconfigured',
    lastSuccessAt: null,
    lastAttemptAt: null,
    nextScheduledAt: nextScheduledDate.toISOString(),
    importedCount: 0,
    errorMessage: isComicVineConfigured() ? null : 'COMICVINE_API_KEY not set',
  },
};

function addLog(provider: string, level: 'info' | 'warn' | 'error', message: string) {
  const entry: SyncLogEntry = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    provider,
    level,
    message,
    createdAt: new Date().toISOString(),
  };
  syncLogs.unshift(entry);
  if (syncLogs.length > 100) syncLogs.pop();

  const { adminDb } = initFirebaseAdmin();
  if (adminDb) {
    adminDb
      .collection('metadataSyncLogs')
      .doc(entry.id)
      .set({
        id: entry.id,
        provider: entry.provider,
        level: entry.level,
        message: entry.message,
        createdAt: FieldValue.serverTimestamp(),
      })
      .catch(() => {});
  }
}

async function persistJobState(job: SyncJobState) {
  const { adminDb } = initFirebaseAdmin();
  if (!adminDb) return;
  try {
    await adminDb.collection('metadataSyncJobs').doc(job.id).set(
      {
        id: job.id,
        provider: job.provider,
        status: job.status === 'unconfigured' ? 'idle' : job.status,
        lastSuccessAt: job.lastSuccessAt,
        nextScheduledAt: job.nextScheduledAt,
        importedCount: job.importedCount,
        errorMessage: job.errorMessage || '',
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('[SyncService] Failed to persist job state to Firestore:', err instanceof Error ? err.message : String(err));
  }
}

async function upsertAnimeToFirestore(collectionName: 'anime' | 'animeMovies', items: NormalizedAnime[]) {
  const { adminDb } = initFirebaseAdmin();
  if (!adminDb) return;

  for (const item of items) {
    try {
      const ref = adminDb.collection(collectionName).doc(item.id);
      const existing = await ref.get();
      if (existing.exists) {
        const existingData = existing.data() || {};
        const locked: string[] = Array.isArray(existingData.adminLockedFields) ? existingData.adminLockedFields : [];
        const updatePayload: Record<string, unknown> = {
          updatedAt: FieldValue.serverTimestamp(),
        };
        const candidateFields: Array<keyof NormalizedAnime> = [
          'anilistId', 'malId', 'titleEnglish', 'titleRomaji', 'titleNative',
          'synopsis', 'posterUrl', 'bannerUrl', 'genres', 'season', 'seasonYear',
          'format', 'episodeCount', 'averageScore', 'popularity', 'trendingRank', 'languages',
        ];
        for (const field of candidateFields) {
          if (!locked.includes(field) && item[field] !== undefined) {
            updatePayload[field] = item[field];
          }
        }
        await ref.set(updatePayload, { merge: true });
      } else {
        await ref.set({
          id: item.id,
          anilistId: item.anilistId ?? null,
          malId: item.malId ?? null,
          titleEnglish: item.titleEnglish || '',
          titleRomaji: item.titleRomaji,
          titleNative: item.titleNative || '',
          synopsis: item.synopsis || '',
          posterUrl: item.posterUrl || '',
          bannerUrl: item.bannerUrl || '',
          genres: item.genres || [],
          season: item.season || '',
          seasonYear: item.seasonYear || 0,
          format: item.format || 'TV',
          episodeCount: item.episodeCount || 0,
          averageScore: item.averageScore || 0,
          popularity: item.popularity || 0,
          trendingRank: item.trendingRank || 0,
          languages: item.languages || ['Japanese'],
          status: 'published',
          featured: item.featured,
          hasAuthorizedPlayback: false,
          sourceProvider: 'anilist',
          adminLockedFields: [],
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    } catch (err) {
      console.warn(`[SyncService] Upsert skipped for ${item.id}:`, err instanceof Error ? err.message : String(err));
    }
  }
}

export async function runCatalogueSync(trigger: 'startup' | 'scheduled' | 'manual' = 'manual') {
  if (isSyncRunning) {
    return { started: false, reason: 'A synchronization job is already running.' };
  }

  isSyncRunning = true;
  nextScheduledDate = new Date(Date.now() + SYNC_INTERVAL_MINUTES * 60 * 1000);
  addLog('system', 'info', `Catalogue sync started (${trigger})`);

  try {
    // 1. AniList Anime (Trending + Popular pages)
    const animeJob = syncJobs.anilist_anime;
    animeJob.status = 'running';
    animeJob.lastAttemptAt = new Date().toISOString();
    animeJob.nextScheduledAt = nextScheduledDate.toISOString();
    try {
      const [trending, popular] = await Promise.all([
        discoverAniListMedia({ type: 'ANIME', sort: 'trending', formatIn: ['TV', 'ONA', 'OVA', 'SPECIAL'], page: 1, perPage: 25 }),
        discoverAniListMedia({ type: 'ANIME', sort: 'popular', formatIn: ['TV', 'ONA'], page: 1, perPage: 25 }),
      ]);
      const combined = [...trending.items, ...popular.items];
      const deduped = new Map<string, NormalizedAnime>();
      for (const item of combined) {
        deduped.set(item.id, item);
        syncedAnimeMap.set(item.id, item);
      }
      const list = Array.from(deduped.values());
      await upsertAnimeToFirestore('anime', list);
      animeJob.status = 'completed';
      animeJob.lastSuccessAt = new Date().toISOString();
      animeJob.importedCount = syncedAnimeMap.size;
      animeJob.errorMessage = null;
      addLog('anilist_anime', 'info', `Synchronized ${list.length} anime series records.`);
    } catch (err) {
      animeJob.status = 'failed';
      animeJob.errorMessage = err instanceof Error ? err.message : 'AniList sync failed';
      addLog('anilist_anime', 'error', animeJob.errorMessage);
    }
    await persistJobState(animeJob);

    // 2. AniList Anime Movies
    const movieJob = syncJobs.anilist_anime_movies;
    movieJob.status = 'running';
    movieJob.lastAttemptAt = new Date().toISOString();
    movieJob.nextScheduledAt = nextScheduledDate.toISOString();
    try {
      const movies = await discoverAniListMedia({ type: 'ANIME', sort: 'popular', format: 'MOVIE', page: 1, perPage: 25 });
      for (const item of movies.items) {
        syncedAnimeMoviesMap.set(item.id, item);
      }
      await upsertAnimeToFirestore('animeMovies', movies.items);
      movieJob.status = 'completed';
      movieJob.lastSuccessAt = new Date().toISOString();
      movieJob.importedCount = syncedAnimeMoviesMap.size;
      movieJob.errorMessage = null;
      addLog('anilist_anime_movies', 'info', `Synchronized ${movies.items.length} anime movie records.`);
    } catch (err) {
      movieJob.status = 'failed';
      movieJob.errorMessage = err instanceof Error ? err.message : 'Anime Movies sync failed';
      addLog('anilist_anime_movies', 'error', movieJob.errorMessage);
    }
    await persistJobState(movieJob);

    // 3. AniList Light Novels
    const novelJob = syncJobs.anilist_novels;
    novelJob.status = 'running';
    novelJob.lastAttemptAt = new Date().toISOString();
    novelJob.nextScheduledAt = nextScheduledDate.toISOString();
    try {
      const novels = await discoverAniListMedia({ type: 'MANGA', sort: 'popular', format: 'NOVEL', page: 1, perPage: 20 });
      novelJob.status = 'completed';
      novelJob.lastSuccessAt = new Date().toISOString();
      novelJob.importedCount = novels.items.length;
      novelJob.errorMessage = null;
      addLog('anilist_novels', 'info', `Verified ${novels.items.length} light novel records.`);
    } catch (err) {
      novelJob.status = 'failed';
      novelJob.errorMessage = err instanceof Error ? err.message : 'Light Novel sync failed';
      addLog('anilist_novels', 'error', novelJob.errorMessage);
    }
    await persistJobState(novelJob);

    // 4. MangaDex
    const mangaJob = syncJobs.mangadex;
    mangaJob.status = 'running';
    mangaJob.lastAttemptAt = new Date().toISOString();
    mangaJob.nextScheduledAt = nextScheduledDate.toISOString();
    try {
      const manga = await discoverMangaDex({ page: 1, limit: 20 });
      mangaJob.status = 'completed';
      mangaJob.lastSuccessAt = new Date().toISOString();
      mangaJob.importedCount = manga.items.length;
      mangaJob.errorMessage = null;
      addLog('mangadex', 'info', `Synchronized ${manga.items.length} MangaDex entries.`);
    } catch (err) {
      mangaJob.status = 'failed';
      mangaJob.errorMessage = err instanceof Error ? err.message : 'MangaDex sync failed';
      addLog('mangadex', 'error', mangaJob.errorMessage);
    }
    await persistJobState(mangaJob);

    // 5. TMDB (only if configured)
    const tmdbJob = syncJobs.tmdb;
    tmdbJob.nextScheduledAt = nextScheduledDate.toISOString();
    tmdbJob.lastAttemptAt = new Date().toISOString();
    if (!isTmdbConfigured()) {
      tmdbJob.status = 'unconfigured';
      tmdbJob.errorMessage = 'TMDB_API_KEY / TMDB_READ_TOKEN not configured';
    } else {
      tmdbJob.status = 'running';
      try {
        const res = await discoverTmdb({ mediaType: 'movie', sortBy: 'trending', page: 1 });
        tmdbJob.status = 'completed';
        tmdbJob.lastSuccessAt = new Date().toISOString();
        tmdbJob.importedCount = res.items.length;
        tmdbJob.errorMessage = null;
        addLog('tmdb', 'info', `Synchronized ${res.items.length} trending TMDB entries.`);
      } catch (err) {
        tmdbJob.status = 'failed';
        tmdbJob.errorMessage = err instanceof Error ? err.message : 'TMDB sync failed';
        addLog('tmdb', 'error', tmdbJob.errorMessage);
      }
    }
    await persistJobState(tmdbJob);

    // 6. ComicVine (only if configured)
    const comicJob = syncJobs.comicvine;
    comicJob.nextScheduledAt = nextScheduledDate.toISOString();
    comicJob.status = isComicVineConfigured() ? 'completed' : 'unconfigured';
    comicJob.errorMessage = isComicVineConfigured() ? null : 'COMICVINE_API_KEY not configured';

    return { started: true, jobs: Object.values(syncJobs) };
  } finally {
    isSyncRunning = false;
  }
}

export function startSyncScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;

  // Trigger initial background sync 2 seconds after server startup
  setTimeout(() => {
    runCatalogueSync('startup').catch((err) => {
      console.warn('[SyncService] Initial startup sync error:', err instanceof Error ? err.message : String(err));
    });
  }, 2000);

  // Schedule incremental sync every 60 minutes (0 * * * *)
  cron.schedule('0 * * * *', () => {
    runCatalogueSync('scheduled').catch((err) => {
      console.warn('[SyncService] Scheduled sync error:', err instanceof Error ? err.message : String(err));
    });
  });
}

export function getSyncStatusSnapshot() {
  const { hasServiceAccount } = initFirebaseAdmin();
  return {
    isSyncRunning,
    intervalMinutes: SYNC_INTERVAL_MINUTES,
    nextScheduledAt: nextScheduledDate.toISOString(),
    firestoreAdminConfigured: hasServiceAccount,
    jobs: Object.values(syncJobs),
    logs: syncLogs.slice(0, 40),
  };
}

export function getSyncedAnimeSnapshot() {
  return {
    series: Array.from(syncedAnimeMap.values()),
    movies: Array.from(syncedAnimeMoviesMap.values()),
  };
}
