import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertCircle, Search, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { apiGet } from '../lib/apiClient';
import type { TmdbMediaItem } from '../lib/types';
import { MediaCard } from '../components/MediaCard';
import { PosterGridSkeleton } from '../components/Skeletons';

interface TmdbDetail {
  id: string;
  title: string;
  originalTitle: string;
  overview: string;
  posterUrl: string;
  backdropUrl: string;
  releaseDate: string;
  runtime: number | null;
  voteAverage: number;
  genres: string[];
  spokenLanguages: string[];
  seasonsCount?: number;
  episodesCount?: number;
  attribution: string;
}

export function MoviesSeriesPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [mediaType, setMediaType] = useState<'movie' | 'tv'>(
    searchParams.get('type') === 'tv' ? 'tv' : 'movie'
  );
  const [query, setQuery] = useState('');
  const [language, setLanguage] = useState('');
  const [region, setRegion] = useState('');
  const [genre, setGenre] = useState('');
  const [sort, setSort] = useState('trending');
  const [page, setPage] = useState(1);

  const [configured, setConfigured] = useState<boolean | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [items, setItems] = useState<TmdbMediaItem[]>([]);
  const [genres, setGenres] = useState<Array<{ id: number; name: string }>>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedDetail, setSelectedDetail] = useState<TmdbDetail | null>(null);

  useEffect(() => {
    apiGet<{ configured: boolean; genres: Array<{ id: number; name: string }> }>(`/api/tmdb/genres/${mediaType}`)
      .then((res) => {
        if (res.configured) setGenres(res.genres);
      })
      .catch(() => {});
  }, [mediaType]);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          mediaType,
          sort,
          page: String(page),
        });
        if (query.trim()) params.set('q', query.trim());
        if (language) params.set('language', language);
        if (region) params.set('region', region);
        if (genre) params.set('genre', genre);

        const res = await apiGet<{
          configured: boolean;
          items: TmdbMediaItem[];
          totalPages: number;
          message?: string | null;
        }>(`/api/tmdb/discover?${params.toString()}`);

        if (!active) return;
        setConfigured(res.configured);
        setItems(res.items || []);
        setTotalPages(res.totalPages || 1);
        setStatusMessage(res.message || null);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [mediaType, query, language, region, genre, sort, page]);

  const detailId = searchParams.get('id');
  const detailType = searchParams.get('type') === 'tv' ? 'tv' : 'movie';

  useEffect(() => {
    if (!detailId) {
      setSelectedDetail(null);
      return;
    }
    apiGet<{ configured: boolean; item: TmdbDetail | null }>(`/api/tmdb/${detailType}/${detailId}`)
      .then((res) => {
        if (res.configured && res.item) setSelectedDetail(res.item);
      })
      .catch(() => {});
  }, [detailId, detailType]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-10 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white">Movies & Web Series</h1>
          <p className="text-sm text-[#A0A0A0] mt-1">
            Official TMDB metadata catalogue — metadata does not imply licensed video streaming
          </p>
        </div>

        <div className="inline-flex p-1 rounded-lg bg-[#121212] border border-white/10">
          {(['movie', 'tv'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setMediaType(t);
                setGenre('');
                setPage(1);
              }}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                mediaType === t ? 'bg-[#FF6A00] text-black' : 'text-[#A0A0A0] hover:text-white'
              }`}
            >
              {t === 'movie' ? 'Movies' : 'Web Series'}
            </button>
          ))}
        </div>
      </div>

      {configured === false ? (
        <div className="rounded-xl bg-[#121212] border border-[#FF6A00]/30 p-8 space-y-3">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-[#FF6A00]" />
            <h2 className="font-display text-lg font-bold text-white">TMDB API Key Not Configured</h2>
          </div>
          <p className="text-sm text-[#A0A0A0] max-w-2xl">
            {statusMessage ||
              'To activate Movies & Web Series discovery, configure TMDB_API_KEY or TMDB_READ_TOKEN in the server environment variables.'}
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-xl bg-[#121212] border border-white/10 p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="lg:col-span-2 relative">
              <Search className="w-4 h-4 text-[#A0A0A0] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder={`Search ${mediaType === 'movie' ? 'movies' : 'TV series'}...`}
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
              <option value="">All Genres</option>
              {genres.map((g) => (
                <option key={g.id} value={String(g.id)}>{g.name}</option>
              ))}
            </select>

            <select
              value={language}
              onChange={(e) => {
                setLanguage(e.target.value);
                setPage(1);
              }}
              className="h-10 px-3 rounded-lg bg-[#080808] border border-white/12 text-sm text-white"
            >
              <option value="">All Languages</option>
              <option value="en-US">English</option>
              <option value="ja-JP">Japanese</option>
              <option value="ko-KR">Korean</option>
              <option value="hi-IN">Hindi</option>
              <option value="es-ES">Spanish</option>
            </select>

            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setPage(1);
              }}
              className="h-10 px-3 rounded-lg bg-[#080808] border border-white/12 text-sm text-white"
            >
              <option value="trending">Trending</option>
              <option value="popular">Popular</option>
              <option value="rating">Top Rated</option>
            </select>
          </div>

          {loading ? (
            <PosterGridSkeleton count={10} />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5">
              {items.map((item) => (
                <MediaCard
                  key={item.id}
                  to={`/movies?id=${item.tmdbId}&type=${item.mediaType}`}
                  title={item.title}
                  subtitle={item.originalTitle !== item.title ? item.originalTitle : undefined}
                  imageUrl={item.posterUrl}
                  metaItems={[item.originalLanguage, item.releaseDate?.slice(0, 4), `${item.voteAverage}/10`]}
                />
              ))}
            </div>
          )}

          <div className="flex items-center justify-center gap-3 pt-4">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#121212] border border-white/10 text-xs font-medium text-white disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>
            <span className="text-xs font-mono text-[#A0A0A0] tabular-nums">
              Page {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#121212] border border-white/10 text-xs font-medium text-white disabled:opacity-40"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </>
      )}

      {/* Detail Modal */}
      {selectedDetail && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSearchParams({})}
        >
          <div
            className="w-full max-w-2xl rounded-xl bg-[#121212] border border-white/15 overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {selectedDetail.backdropUrl && (
              <div className="h-48 relative">
                <img
                  src={selectedDetail.backdropUrl}
                  alt={selectedDetail.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => setSearchParams({})}
                  className="absolute top-3 right-3 w-8 h-8 rounded-lg bg-black/70 text-white flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            <div className="p-6 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-display text-2xl font-bold text-white">{selectedDetail.title}</h2>
                  <p className="text-xs text-[#A0A0A0] mt-1">
                    {selectedDetail.releaseDate} · {selectedDetail.voteAverage}/10
                    {selectedDetail.runtime ? ` · ${selectedDetail.runtime} min` : ''}
                  </p>
                </div>
                {!selectedDetail.backdropUrl && (
                  <button type="button" onClick={() => setSearchParams({})} className="text-[#A0A0A0] hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
              <p className="text-sm text-[#A0A0A0] leading-relaxed">{selectedDetail.overview}</p>
              <p className="text-xs text-white/80">
                Genres: {selectedDetail.genres.join(', ') || 'N/A'} · Languages:{' '}
                {selectedDetail.spokenLanguages.join(', ') || 'N/A'}
              </p>
              <p className="text-[11px] text-[#A0A0A0]/80 border-t border-white/8 pt-3">
                {selectedDetail.attribution} No external unauthorized video stream is attached.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
