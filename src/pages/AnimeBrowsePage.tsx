import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { apiGet } from '../lib/apiClient';
import { ANIME_GENRES } from '../lib/presets';
import type { AnimeItem } from '../lib/types';
import { MediaCard } from '../components/MediaCard';
import { PosterGridSkeleton } from '../components/Skeletons';

export function AnimeBrowsePage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [genre, setGenre] = useState(searchParams.get('genre') || 'All');
  const [format, setFormat] = useState(searchParams.get('format') || 'ALL');
  const [language, setLanguage] = useState(searchParams.get('lang') || 'all');
  const [sort, setSort] = useState(searchParams.get('sort') || 'trending');
  const [page, setPage] = useState(Number(searchParams.get('page') || 1));

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<AnimeItem[]>([]);
  const [hasNextPage, setHasNextPage] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (query.trim()) params.set('q', query.trim());
        if (genre !== 'All') params.set('genre', genre);
        if (format !== 'ALL') params.set('format', format);
        if (language !== 'all') params.set('language', language);
        params.set('sort', sort);
        params.set('page', String(page));
        params.set('perPage', '20');

        const res = await apiGet<{
          items: AnimeItem[];
          pageInfo: { hasNextPage: boolean };
        }>(`/api/anime/discover?${params.toString()}`);

        if (!active) return;
        setItems(res.items);
        setHasNextPage(Boolean(res.pageInfo?.hasNextPage));
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [query, genre, format, language, sort, page]);

  const applySearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    const next = new URLSearchParams(searchParams);
    if (query.trim()) next.set('q', query.trim());
    else next.delete('q');
    setSearchParams(next);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-10 space-y-8">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white">Browse Anime</h1>
        <p className="text-sm text-[#A0A0A0] mt-1">
          Filter by genre, format, origin language, and popularity
        </p>
      </div>

      {/* Filters Toolbar */}
      <form
        onSubmit={applySearch}
        className="rounded-xl bg-[#121212] border border-white/10 p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3"
      >
        <div className="lg:col-span-2 relative">
          <Search className="w-4 h-4 text-[#A0A0A0] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search anime title..."
            className="w-full h-10 pl-9 pr-3 rounded-lg bg-[#080808] border border-white/12 text-sm text-white focus:outline-none focus:border-[#FF6A00]"
          />
        </div>

        <select
          value={genre}
          onChange={(e) => {
            setGenre(e.target.value);
            setPage(1);
          }}
          className="h-10 px-3 rounded-lg bg-[#080808] border border-white/12 text-sm text-white"
        >
          <option value="All">All Genres</option>
          {ANIME_GENRES.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>

        <select
          value={format}
          onChange={(e) => {
            setFormat(e.target.value);
            setPage(1);
          }}
          className="h-10 px-3 rounded-lg bg-[#080808] border border-white/12 text-sm text-white"
        >
          <option value="ALL">All Formats</option>
          <option value="TV">TV Series</option>
          <option value="MOVIE">Movie</option>
          <option value="OVA">OVA</option>
          <option value="ONA">ONA</option>
          <option value="SPECIAL">Special</option>
        </select>

        <select
          value={language}
          onChange={(e) => {
            setLanguage(e.target.value);
            setPage(1);
          }}
          className="h-10 px-3 rounded-lg bg-[#080808] border border-white/12 text-sm text-white"
        >
          <option value="all">All Languages</option>
          <option value="japanese">Japanese</option>
          <option value="korean">Korean</option>
          <option value="chinese">Chinese</option>
        </select>

        <select
          value={sort}
          onChange={(e) => {
            setSort(e.target.value);
            setPage(1);
          }}
          className="h-10 px-3 rounded-lg bg-[#080808] border border-white/12 text-sm text-white"
        >
          <option value="trending">Sort: Trending</option>
          <option value="popular">Sort: Popular</option>
          <option value="score">Sort: Highest Score</option>
          <option value="recent">Sort: Newest</option>
        </select>
      </form>

      {loading ? (
        <PosterGridSkeleton count={15} />
      ) : items.length === 0 ? (
        <div className="rounded-xl bg-[#121212] border border-white/8 p-10 text-center space-y-2">
          <p className="text-base font-semibold text-white">No matching anime found</p>
          <p className="text-sm text-[#A0A0A0]">Try broadening your genre, format, or search query.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5">
          {items.map((item) => (
            <MediaCard
              key={item.id}
              to={`/anime/${item.id}`}
              title={item.titleEnglish || item.titleRomaji}
              subtitle={item.genres.slice(0, 2).join(' · ')}
              imageUrl={item.posterUrl}
              metaItems={[item.format, item.seasonYear, item.averageScore ? `${item.averageScore}%` : null]}
              hasWatchableStream={item.hasAuthorizedPlayback}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-center gap-3 pt-4">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#121212] border border-white/10 text-xs font-medium text-white disabled:opacity-40 hover:border-[#FF6A00]"
        >
          <ChevronLeft className="w-4 h-4" />
          Previous
        </button>
        <span className="text-xs font-mono text-[#A0A0A0] tabular-nums">Page {page}</span>
        <button
          type="button"
          disabled={!hasNextPage}
          onClick={() => setPage((p) => p + 1)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#121212] border border-white/10 text-xs font-medium text-white disabled:opacity-40 hover:border-[#FF6A00]"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
