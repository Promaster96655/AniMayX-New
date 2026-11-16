import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  getUserWatchProgress,
  getUserWatchlist,
  removeWatchlistEntry,
} from '../lib/firestoreService';
import type { WatchlistEntry, WatchProgressEntry } from '../lib/types';
import { MediaCard } from '../components/MediaCard';

export function WatchlistPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [filter, setFilter] = useState<'all' | WatchlistEntry['watchStatus']>('all');
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([]);
  const [progress, setProgress] = useState<WatchProgressEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([getUserWatchlist(user.uid), getUserWatchProgress(user.uid)])
      .then(([wl, wp]) => {
        setWatchlist(wl);
        setProgress(wp);
      })
      .finally(() => setLoading(false));
  }, [user]);

  const handleRemove = async (mediaId: string) => {
    if (!user) return;
    await removeWatchlistEntry(user.uid, mediaId);
    setWatchlist((prev) => prev.filter((item) => item.mediaId !== mediaId));
    showToast('Removed from watchlist', 'info');
  };

  const filtered = filter === 'all' ? watchlist : watchlist.filter((w) => w.watchStatus === filter);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-10 space-y-10">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white">My Watchlist & Library</h1>
          <p className="text-sm text-[#A0A0A0] mt-1">
            Track series progress, saved manga, and planned releases
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 bg-[#121212] p-1 rounded-lg border border-white/8">
          {(['all', 'watching', 'planned', 'completed', 'on_hold', 'dropped'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
                filter === tab ? 'bg-[#FF6A00] text-black font-semibold' : 'text-[#A0A0A0] hover:text-white'
              }`}
            >
              {tab.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {progress.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-display text-lg font-bold text-white">Recent Playback Progress</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {progress.slice(0, 8).map((p) => (
              <Link
                key={`${p.animeId}_${p.episodeNumber}`}
                to={`/anime/${p.animeId}/watch?ep=${p.episodeNumber}`}
                className="rounded-xl bg-[#121212] border border-white/8 p-4 hover:border-[#FF6A00]/50 transition-colors"
              >
                <p className="text-sm font-semibold text-white truncate">{p.animeTitle || p.animeId}</p>
                <p className="text-xs text-[#A0A0A0] font-mono tabular-nums mt-1">
                  Episode {p.episodeNumber} · {Math.floor(p.positionSeconds / 60)}m / {Math.floor(p.durationSeconds / 60)}m
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {loading ? (
        <p className="text-sm text-[#A0A0A0]">Loading watchlist...</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl bg-[#121212] border border-white/8 p-10 text-center space-y-3">
          <p className="text-base font-semibold text-white">Your watchlist is empty</p>
          <Link
            to="/anime/browse"
            className="inline-flex px-4 py-2 rounded-lg bg-[#FF6A00] text-black text-xs font-semibold"
          >
            Browse Anime
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
          {filtered.map((item) => (
            <div key={item.mediaId} className="space-y-2">
              <MediaCard
                to={
                  item.category === 'manga'
                    ? `/manga/${item.mediaId}`
                    : item.category === 'novel'
                    ? `/novels/${item.mediaId}`
                    : `/anime/${item.mediaId}`
                }
                title={item.title}
                imageUrl={item.posterUrl}
                metaItems={[item.category, item.watchStatus]}
              />
              <button
                type="button"
                onClick={() => handleRemove(item.mediaId)}
                className="inline-flex items-center gap-1 text-xs text-[#A0A0A0] hover:text-rose-400"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
