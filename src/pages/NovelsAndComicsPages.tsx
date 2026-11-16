import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertCircle, Search } from 'lucide-react';
import { apiGet } from '../lib/apiClient';
import type { AnimeItem } from '../lib/types';
import { MediaCard } from '../components/MediaCard';
import { PosterGridSkeleton } from '../components/Skeletons';

export function LightNovelsPage() {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('popular');
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<AnimeItem[]>([]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const params = new URLSearchParams({ sort, page: '1' });
    if (query.trim()) params.set('q', query.trim());

    apiGet<{ items: AnimeItem[] }>(`/api/novels/discover?${params.toString()}`)
      .then((res) => {
        if (active) setItems(res.items || []);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [query, sort]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-10 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white">Light Novels</h1>
          <p className="text-sm text-[#A0A0A0] mt-1">
            Light novel volumes, genres, and metadata synchronized from AniList
          </p>
        </div>
        <Link to="/comics" className="text-xs font-medium text-[#FF6A00] hover:underline">
          Switch to Comics →
        </Link>
      </div>

      <div className="rounded-xl bg-[#121212] border border-white/10 p-4 flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-[#A0A0A0] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search light novels..."
            className="w-full h-10 pl-9 pr-3 rounded-lg bg-[#080808] border border-white/12 text-sm text-white focus:outline-none focus:border-[#FF6A00]"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="h-10 px-3 rounded-lg bg-[#080808] border border-white/12 text-sm text-white"
        >
          <option value="popular">Most Popular</option>
          <option value="score">Highest Rated</option>
          <option value="trending">Trending</option>
        </select>
      </div>

      {loading ? (
        <PosterGridSkeleton count={10} />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5">
          {items.map((n) => (
            <MediaCard
              key={n.id}
              to={`/novels/${n.id}`}
              title={n.titleEnglish || n.titleRomaji}
              subtitle={n.genres.slice(0, 2).join(' · ')}
              imageUrl={n.posterUrl}
              metaItems={[n.volumes ? `${n.volumes} Vols` : 'Novel', n.averageScore ? `${n.averageScore}%` : null]}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function LightNovelDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [novel, setNovel] = useState<AnimeItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    apiGet<{ novel: AnimeItem }>(`/api/novels/${id}`)
      .then((res) => setNovel(res.novel))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="max-w-5xl mx-auto px-4 py-16 text-sm text-[#A0A0A0]">Loading light novel...</div>;
  }
  if (!novel) {
    return <div className="max-w-5xl mx-auto px-4 py-16 text-sm text-[#A0A0A0]">Light novel not found.</div>;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8 py-10 space-y-6">
      <div className="flex flex-col md:flex-row gap-8">
        <img
          src={novel.posterUrl}
          alt={novel.titleEnglish || novel.titleRomaji}
          referrerPolicy="no-referrer"
          className="w-48 aspect-[2/3] rounded-xl object-cover bg-[#121212] border border-white/10 shrink-0"
        />
        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium text-[#FF6A00]">
              Light Novel {novel.volumes ? `· ${novel.volumes} Volumes` : ''}{' '}
              {novel.averageScore ? `· ${novel.averageScore}%` : ''}
            </p>
            <h1 className="font-display text-2xl sm:text-4xl font-extrabold text-white mt-1">
              {novel.titleEnglish || novel.titleRomaji}
            </h1>
          </div>
          <p className="text-sm text-[#A0A0A0] leading-relaxed whitespace-pre-line">
            {novel.synopsis || 'No synopsis available.'}
          </p>
          <div className="rounded-lg bg-[#121212] border border-white/10 p-4 text-xs text-[#A0A0A0]">
            Metadata sourced from AniList. In-app reading is only activated when a licensed text/EPUB source is configured.
          </div>
        </div>
      </div>
    </div>
  );
}

export function ComicsPage() {
  const [query, setQuery] = useState('');
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [items, setItems] = useState<
    Array<{ id: string; title: string; description: string; startYear: string; issueCount: number; publisher: string; coverUrl: string }>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiGet<{
      configured: boolean;
      items: typeof items;
      message?: string | null;
    }>(`/api/comics/discover?q=${encodeURIComponent(query)}`)
      .then((res) => {
        if (!active) return;
        setConfigured(res.configured);
        setItems(res.items || []);
        setMessage(res.message || null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [query]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-10 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white">Comics</h1>
          <p className="text-sm text-[#A0A0A0] mt-1">
            Western comic volumes and publisher records via ComicVine
          </p>
        </div>
        <Link to="/novels" className="text-xs font-medium text-[#FF6A00] hover:underline">
          Switch to Light Novels →
        </Link>
      </div>

      {configured === false ? (
        <div className="rounded-xl bg-[#121212] border border-[#FF6A00]/30 p-8 space-y-3">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-[#FF6A00]" />
            <h2 className="font-display text-lg font-bold text-white">Comics Provider Not Configured</h2>
          </div>
          <p className="text-sm text-[#A0A0A0] max-w-2xl">
            {message ||
              'Set COMICVINE_API_KEY in server environment variables to enable ComicVine comic volume search and metadata.'}
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-xl bg-[#121212] border border-white/10 p-4">
            <div className="relative max-w-md">
              <Search className="w-4 h-4 text-[#A0A0A0] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search comic volumes..."
                className="w-full h-10 pl-9 pr-3 rounded-lg bg-[#080808] border border-white/12 text-sm text-white focus:outline-none focus:border-[#FF6A00]"
              />
            </div>
          </div>
          {loading ? (
            <PosterGridSkeleton count={10} />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              {items.map((c) => (
                <MediaCard
                  key={c.id}
                  to={`/comics?q=${encodeURIComponent(c.title)}`}
                  title={c.title}
                  subtitle={c.publisher}
                  imageUrl={c.coverUrl}
                  metaItems={[c.startYear, `${c.issueCount} Issues`]}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
