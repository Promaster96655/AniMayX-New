import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { apiGet } from '../lib/apiClient';
import { listPublishedFirestoreAnime } from '../lib/firestoreService';
import type { AnimeItem } from '../lib/types';
import { MediaCard } from '../components/MediaCard';
import { PosterGridSkeleton } from '../components/Skeletons';

function getCurrentAnimeSeason() {
  const month = new Date().getMonth() + 1;
  const year = new Date().getFullYear();
  if (month <= 3) return { season: 'WINTER', year };
  if (month <= 6) return { season: 'SPRING', year };
  if (month <= 9) return { season: 'SUMMER', year };
  return { season: 'FALL', year };
}

export function AnimeHubPage({ mode = 'hub' }: { mode?: 'hub' | 'trending' | 'popular' | 'movies' }) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<AnimeItem[]>([]);
  const [seasonal, setSeasonal] = useState<AnimeItem[]>([]);
  const [movies, setMovies] = useState<AnimeItem[]>([]);
  const [recentAdded, setRecentAdded] = useState<AnimeItem[]>([]);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const current = getCurrentAnimeSeason();
        if (mode === 'trending') {
          const res = await apiGet<{ items: AnimeItem[] }>('/api/anime/discover?sort=trending&perPage=25');
          if (active) setItems(res.items);
        } else if (mode === 'popular') {
          const res = await apiGet<{ items: AnimeItem[] }>('/api/anime/discover?sort=popular&perPage=25');
          if (active) setItems(res.items);
        } else if (mode === 'movies') {
          const [res, fsMovies] = await Promise.all([
            apiGet<{ items: AnimeItem[] }>('/api/anime/discover?category=movies&sort=popular&perPage=25'),
            listPublishedFirestoreAnime('animeMovies'),
          ]);
          const map = new Map<string, AnimeItem>();
          for (const m of fsMovies) map.set(m.id, m);
          for (const m of res.items) if (!map.has(m.id)) map.set(m.id, m);
          if (active) setItems(Array.from(map.values()));
        } else {
          const [trendRes, seasonRes, movieRes, fsAnime] = await Promise.all([
            apiGet<{ items: AnimeItem[] }>('/api/anime/discover?sort=trending&perPage=10'),
            apiGet<{ items: AnimeItem[] }>(
              `/api/anime/discover?season=${current.season}&year=${current.year}&sort=popular&perPage=10`
            ),
            apiGet<{ items: AnimeItem[] }>('/api/anime/discover?category=movies&sort=popular&perPage=5'),
            listPublishedFirestoreAnime('anime'),
          ]);
          if (!active) return;
          setItems(trendRes.items);
          setSeasonal(seasonRes.items);
          setMovies(movieRes.items);
          setRecentAdded(fsAnime.slice(0, 10));
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [mode]);

  const titleMap = {
    hub: 'Anime Hub',
    trending: 'Trending Anime',
    popular: 'Popular Anime',
    movies: 'Anime Movies',
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-10 space-y-12">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-white/8 pb-6">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white">{titleMap[mode]}</h1>
          <p className="text-sm text-[#A0A0A0] mt-1">
            Watch Free Animes · Curated metadata and authorized streaming episodes
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {[
            { to: '/anime', label: 'Overview' },
            { to: '/anime/trending', label: 'Trending' },
            { to: '/anime/popular', label: 'Popular' },
            { to: '/anime/movies', label: 'Anime Movies' },
            { to: '/anime/browse', label: 'Filter & Search' },
          ].map((tab) => (
            <Link
              key={tab.to}
              to={tab.to}
              className="px-3.5 py-2 rounded-lg bg-[#121212] border border-white/10 hover:border-[#FF6A00] text-xs font-medium text-white transition-colors whitespace-nowrap"
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </div>

      {loading ? (
        <PosterGridSkeleton count={10} />
      ) : mode !== 'hub' ? (
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
      ) : (
        <>
          {recentAdded.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-bold text-white">Published in AniMayX Catalogue</h2>
                <Link to="/anime/browse" className="text-xs text-[#FF6A00] hover:underline inline-flex items-center gap-1">
                  Browse All <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 sm:gap-5">
                {recentAdded.map((item) => (
                  <MediaCard
                    key={item.id}
                    to={`/anime/${item.id}`}
                    title={item.titleEnglish || item.titleRomaji}
                    subtitle={item.genres.slice(0, 2).join(' · ')}
                    imageUrl={item.posterUrl}
                    metaItems={[item.format, item.seasonYear, item.hasAuthorizedPlayback ? 'Stream Ready' : 'Metadata']}
                    hasWatchableStream={item.hasAuthorizedPlayback}
                  />
                ))}
              </div>
            </section>
          )}

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-white">Trending Now</h2>
              <Link to="/anime/trending" className="text-xs text-[#FF6A00] hover:underline inline-flex items-center gap-1">
                View All <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 sm:gap-5">
              {items.map((item) => (
                <MediaCard
                  key={item.id}
                  to={`/anime/${item.id}`}
                  title={item.titleEnglish || item.titleRomaji}
                  subtitle={item.genres.slice(0, 2).join(' · ')}
                  imageUrl={item.posterUrl}
                  metaItems={[item.format, item.seasonYear, item.averageScore ? `${item.averageScore}%` : null]}
                />
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-white">Seasonal Releases</h2>
              <Link to="/anime/browse?sort=recent" className="text-xs text-[#FF6A00] hover:underline inline-flex items-center gap-1">
                Filter Seasons <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 sm:gap-5">
              {seasonal.map((item) => (
                <MediaCard
                  key={item.id}
                  to={`/anime/${item.id}`}
                  title={item.titleEnglish || item.titleRomaji}
                  subtitle={item.genres.slice(0, 2).join(' · ')}
                  imageUrl={item.posterUrl}
                  metaItems={[item.season, item.seasonYear]}
                />
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-white">Anime Movies</h2>
              <Link to="/anime/movies" className="text-xs text-[#FF6A00] hover:underline inline-flex items-center gap-1">
                All Anime Movies <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 sm:gap-5">
              {movies.map((item) => (
                <MediaCard
                  key={item.id}
                  to={`/anime/${item.id}`}
                  title={item.titleEnglish || item.titleRomaji}
                  subtitle={item.genres.slice(0, 2).join(' · ')}
                  imageUrl={item.posterUrl}
                  metaItems={['MOVIE', item.seasonYear, item.averageScore ? `${item.averageScore}%` : null]}
                />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
