import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { deleteUser } from 'firebase/auth';
import { Shield, Settings, Trash2, Edit3, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  deleteUserAccountRecords,
  getUserProfileByUsername,
  getUserWatchlist,
  updateUserPrivatePreferences,
} from '../lib/firestoreService';
import { apiGet, apiPost } from '../lib/apiClient';
import { PROFILE_FRAMES, PROFILE_THEMES } from '../lib/presets';
import type { UserProfile, WatchlistEntry } from '../lib/types';
import { MediaCard } from '../components/MediaCard';

export function ProfilePage() {
  const { username } = useParams<{ username?: string }>();
  const { user, profile: myProfile, privateInfo, isAdmin, refreshProfile, refreshAdminState, logout } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [viewedProfile, setViewedProfile] = useState<UserProfile | null>(null);
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [prefLang, setPrefLang] = useState('Japanese');
  const [skipEnabled, setSkipEnabled] = useState(true);
  const [bootstrapAvailable, setBootstrapAvailable] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isOwnProfile = !username || (myProfile && myProfile.username === username.toLowerCase());

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        let target: UserProfile | null = null;
        if (!username) {
          target = myProfile;
        } else {
          target = await getUserProfileByUsername(username);
        }
        if (!active) return;
        setViewedProfile(target);

        if (target && (target.watchlistVisibility === 'public' || (user && user.uid === target.uid))) {
          const wl = await getUserWatchlist(target.uid).catch(() => []);
          if (active) setWatchlist(wl);
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [username, myProfile, user]);

  useEffect(() => {
    if (privateInfo) {
      setPrefLang(privateInfo.preferredLanguage);
      setSkipEnabled(privateInfo.skipIntroEnabled);
    }
  }, [privateInfo]);

  useEffect(() => {
    if (!user || !isOwnProfile) return;
    apiGet<{ email: string; emailVerified: boolean; initialAdminEmail: string; bootstrapCompleted: boolean }>(
      '/api/admin/me',
      true
    )
      .then((me) => {
        setBootstrapAvailable(
          me.emailVerified && me.email === me.initialAdminEmail && !me.bootstrapCompleted
        );
      })
      .catch(() => setBootstrapAvailable(false));
  }, [user, isOwnProfile]);

  const handleSaveSettings = async () => {
    if (!user) return;
    try {
      await updateUserPrivatePreferences(user.uid, {
        preferredLanguage: prefLang,
        skipIntroEnabled: skipEnabled,
      });
      await refreshProfile();
      showToast('Preferences saved', 'success');
    } catch (err) {
      showToast('Could not save settings', 'error', err instanceof Error ? err.message : 'Try again.');
    }
  };

  const handleAdminBootstrap = async () => {
    try {
      const res = await apiPost<{ message: string }>('/api/admin/bootstrap', {}, true);
      await refreshAdminState();
      setBootstrapAvailable(false);
      showToast('Initial Admin Provisioned', 'success', res.message);
    } catch (err) {
      showToast('Bootstrap failed', 'error', err instanceof Error ? err.message : 'Unable to complete bootstrap.');
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    try {
      await deleteUserAccountRecords(user.uid, myProfile?.username);
      await deleteUser(user);
      showToast('Account deleted', 'info');
      navigate('/');
    } catch (err) {
      showToast(
        'Re-authentication required',
        'error',
        err instanceof Error ? err.message : 'Sign out and sign back in to delete your account.'
      );
      await logout();
    }
  };

  if (loading) {
    return <div className="max-w-5xl mx-auto px-4 py-16 text-sm text-[#A0A0A0]">Loading profile...</div>;
  }

  if (!viewedProfile) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center space-y-3">
        <h1 className="font-display text-2xl font-bold text-white">Profile Not Found</h1>
        <p className="text-sm text-[#A0A0A0]">
          This profile may be private or does not exist.
        </p>
      </div>
    );
  }

  const theme = PROFILE_THEMES.find((t) => t.id === viewedProfile.themeId) || PROFILE_THEMES[0];
  const frame = PROFILE_FRAMES.find((f) => f.id === viewedProfile.frameId) || PROFILE_FRAMES[0];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 space-y-8">
      {/* Profile Hero Banner */}
      <div className={`rounded-xl overflow-hidden border ${theme.borderClass} ${theme.surfaceClass}`}>
        <div className="h-44 sm:h-56 relative">
          {viewedProfile.bannerUrl && (
            <img
              src={viewedProfile.bannerUrl}
              alt={viewedProfile.displayName}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
        </div>

        <div className="px-6 pb-6 -mt-12 relative flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="flex items-end gap-4">
            <img
              src={viewedProfile.avatarUrl}
              alt={viewedProfile.displayName}
              referrerPolicy="no-referrer"
              className={`w-24 h-24 rounded-full object-cover bg-[#080808] ${frame.ringStyle}`}
            />
            <div>
              <h1 className="font-display text-2xl font-bold text-white">{viewedProfile.displayName}</h1>
              <p className="text-xs text-[#A0A0A0] tabular-nums">
                @{viewedProfile.username} · Joined {new Date(viewedProfile.joinDate).toLocaleDateString()} · {theme.name}
              </p>
            </div>
          </div>

          {isOwnProfile && user && (
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/setup-profile"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#FF6A00] hover:bg-[#FF7E24] text-black text-xs font-semibold"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Edit Profile
              </Link>
              {isAdmin && (
                <Link
                  to="/admin/anime"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#FF6A00]/40 text-[#FF6A00] text-xs font-semibold hover:bg-[#FF6A00]/10"
                >
                  <Shield className="w-3.5 h-3.5" />
                  Admin Panel
                </Link>
              )}
            </div>
          )}
        </div>

        <div className="px-6 pb-6 space-y-2 border-t border-white/8 pt-4">
          {viewedProfile.bio && <p className="text-sm text-white/90">{viewedProfile.bio}</p>}
          {viewedProfile.favoriteGenres.length > 0 && (
            <p className="text-xs text-[#A0A0A0]">
              Interests: {viewedProfile.favoriteGenres.join(' · ')}
            </p>
          )}
          {viewedProfile.badges.length > 0 && (
            <p className="text-xs text-[#FF6A00]">
              Badges: {viewedProfile.badges.join(' · ')}
            </p>
          )}
        </div>
      </div>

      {/* One-time Initial Admin Bootstrap (visible ONLY to verified mrzorvixofficial@gmail.com) */}
      {isOwnProfile && bootstrapAvailable && (
        <div className="rounded-xl bg-[#121212] border border-[#FF6A00]/40 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-base font-bold text-white">One-Time Initial Administrator Setup</h2>
            <p className="text-xs text-[#A0A0A0] mt-1">
              Your verified account matches the designated initial administrator. Provision your protected admin role and disable bootstrap.
            </p>
          </div>
          <button
            type="button"
            onClick={handleAdminBootstrap}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#FF6A00] hover:bg-[#FF7E24] text-black text-xs font-semibold shrink-0"
          >
            <CheckCircle2 className="w-4 h-4" />
            Complete Admin Setup
          </button>
        </div>
      )}

      {/* Watchlist */}
      <section className="space-y-4">
        <h2 className="font-display text-xl font-bold text-white">
          Watchlist ({viewedProfile.watchlistVisibility})
        </h2>
        {viewedProfile.watchlistVisibility === 'private' && !isOwnProfile ? (
          <p className="text-sm text-[#A0A0A0]">This member’s watchlist is private.</p>
        ) : watchlist.length === 0 ? (
          <div className="rounded-xl bg-[#121212] border border-white/8 p-6 text-sm text-[#A0A0A0]">
            No titles saved to this watchlist yet.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {watchlist.map((entry) => (
              <MediaCard
                key={entry.mediaId}
                to={
                  entry.category === 'manga'
                    ? `/manga/${entry.mediaId}`
                    : entry.category === 'novel'
                    ? `/novels/${entry.mediaId}`
                    : `/anime/${entry.mediaId}`
                }
                title={entry.title}
                imageUrl={entry.posterUrl}
                metaItems={[entry.category, entry.watchStatus]}
              />
            ))}
          </div>
        )}
      </section>

      {/* Private Account Settings & Deletion */}
      {isOwnProfile && user && (
        <section className="rounded-xl bg-[#121212] border border-white/10 p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-[#FF6A00]" />
            <h2 className="font-display text-lg font-bold text-white">Account & Playback Settings</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-[#A0A0A0]">Preferred Audio / Language</span>
              <select
                value={prefLang}
                onChange={(e) => setPrefLang(e.target.value)}
                className="w-full h-10 px-3 rounded-lg bg-[#080808] border border-white/12 text-sm text-white"
              >
                <option value="Japanese">Japanese (Original)</option>
                <option value="English">English</option>
                <option value="Korean">Korean</option>
                <option value="Chinese">Chinese</option>
              </select>
            </label>

            <label className="flex items-center gap-3 pt-6 cursor-pointer">
              <input
                type="checkbox"
                checked={skipEnabled}
                onChange={(e) => setSkipEnabled(e.target.checked)}
                className="w-4 h-4 accent-[#FF6A00]"
              />
              <span className="text-sm text-white">Enable AniSkip Opening/Ending skip prompts</span>
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-white/8">
            <button
              type="button"
              onClick={handleSaveSettings}
              className="px-4 py-2 rounded-lg bg-[#FF6A00] hover:bg-[#FF7E24] text-black text-xs font-semibold"
            >
              Save Preferences
            </button>

            {!confirmDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-1.5 text-xs text-rose-400 hover:underline"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Account
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-rose-400">Confirm permanent deletion?</span>
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold"
                >
                  Confirm Delete
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="px-3 py-1.5 rounded-lg border border-white/15 text-xs text-[#A0A0A0]"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
