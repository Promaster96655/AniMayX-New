import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ArrowRight, Play, AlertCircle } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { apiGet } from '../lib/apiClient';
import { useAuth } from '../contexts/AuthContext';
import { getUserWatchProgress, listPublishedFirestoreAnime } from '../lib/firestoreService';
import { HERO_KEY_VISUALS } from '../lib/presets';
import type { AnimeItem, MangaDexItem, TmdbMediaItem, WatchProgressEntry } from '../lib/types';
import { MediaCard } from '../components/MediaCard';
import { HeroSkeleton, PosterGridSkeleton } from '../components/Skeletons';
import { DiscordHomeCard } from '../components/DiscordCommunitySection';

export function HomePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [heroIndex, setHeroIndex] = useState(0);

  const [trendingAnime, setTrendingAnime] = useState<AnimeItem[]>([]);
  const [firestoreFeatured, setFirestoreFeatured] = useState<AnimeItem[]>([]);
  const [continueWatching, setContinueWatching] = useState<WatchProgressEntry[]>([]);
  const [tmdbItems, setTmdbItems] = useState<TmdbMediaItem[]>([]);
  const [tmdbConfigured, setTmdbConfigured] = useState<boolean>(false);
  const [mangaItems, setMangaItems] = useState<MangaDexItem[]>([]);
  const [novelItems, setNovelItems] = useState<AnimeItem[]>([]);
  const [comicsConfigured, setComicsConfigured] = useState<boolean>(false);
  const [comicItems, setComicItems] = useState<Array<{ id: string; title: string; coverUrl: string; publisher: string; startYear: string }>>([]);

  useEffect(() => {
    let active = true;

    async function loadHome() {
      setLoading(true);
      try {
        const [animeRes, fsAnime, tmdbRes, mangaRes, novelRes, comicsRes] = await Promise.all([
          apiGet<{ items: AnimeItem[] }>('/api/anime/discover?sort=trending&perPage=10').catch(() => ({ items: [] })),
          listPublishedFirestoreAnime('anime').catch(() => []),
          apiGet<{ configured: boolean; items: TmdbMediaItem[] }>('/api/tmdb/discover?mediaType=movie&sort=trending').catch(() => ({
            configured: false,
            items: [],
          })),
          apiGet<{ items: MangaDexItem[] }>('/api/manga/discover?page=1').catch(() => ({ items: [] })),
          apiGet<{ items: AnimeItem[] }>('/api/novels/discover?sort=popular&page=1').catch(() => ({ items: [] })),
          apiGet<{ configured: boolean; items: Array<{ id: string; title: string; coverUrl: string; publisher: string; startYear: string }> }>('/api/comics/discover').catch(() => ({
            configured: false,
            items: [],
          })),
        ]);

        if (!active) return;

        // Merge admin-published Firestore titles first so admin edits & playback flags show immediately
        const mergedMap = new Map<string, AnimeItem>();
        for (const item of fsAnime) mergedMap.set(item.id, item);
        for (const item of animeRes.items) {
          if (!mergedMap.has(item.id)) mergedMap.set(item.id, item);
        }
        const merged = Array.from(mergedMap.values());
        setFirestoreFeatured(fsAnime.filter((a) => a.featured));
        setTrendingAnime(merged.slice(0, 10));
        setTmdbConfigured(Boolean(tmdbRes.configured));
        setTmdbItems((tmdbRes.items || []).slice(0, 5));
        setMangaItems((mangaRes.items || []).slice(0, 5));
        setNovelItems((novelRes.items || []).slice(0, 5));
        setComicsConfigured(Boolean(comicsRes.configured));
        setComicItems((comicsRes.items || []).slice(0, 5));
      } finally {
        if (active) setLoading(false);
      }
    }

    loadHome();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setContinueWatching([]);
      return;
    }
    getUserWatchProgress(user.uid)
      .then((items) => setContinueWatching(items.slice(0, 5)))
      .catch(() => {});
  }, [user]);

  const heroSlides = (firestoreFeatured.length > 0 ? firestoreFeatured : trendingAnime).slice(0, 5);

  useEffect(() => {
    if (heroSlides.length <= 1) return;
    const interval = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % heroSlides.length);
    }, 6500);
    return () => clearInterval(interval);
  }, [heroSlides.length]);

  const activeSlide = heroSlides[heroIndex];
  const activeHeroBackdrop =
    activeSlide?.bannerUrl || HERO_KEY_VISUALS[heroIndex % HERO_KEY_VISUALS.length];

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      {/* 1. Animated Hero Carousel */}
      {loading ? (
        <HeroSkeleton />
      ) : activeSlide ? (
        <section className="relative w-full h-[460px] md:h-[540px] overflow-hidden border-b border-white/8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSlide.id}
              initial={{ opacity: 0, scale: 1.02 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-0"
            >
              <img
                src={activeHeroBackdrop}
                alt={activeSlide.titleEnglish || activeSlide.titleRomaji}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover object-center"
              />
              {!activeSlide.bannerUrl && activeSlide.posterUrl && (
                <img
                  src={activeSlide.posterUrl}
                  alt=""
                  aria-hidden="true"
                  referrerPolicy="no-referrer"
                  className="absolute inset-0 w-full h-full object-cover object-center opacity-25 blur-2xl scale-110 pointer-events-none"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#080808] via-[#080808]/68 to-[#080808]/30" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#080808]/95 via-[#080808]/60 to-[#080808]/20" />
            </motion.div>
          </AnimatePresence>

          <div className="relative z-10 max-w-7xl mx-auto h-full px-4 sm:px-8 flex items-end justify-between gap-8 pb-12 sm:pb-16">
            <div className="max-w-2xl space-y-3">
              <p className="text-xs font-medium text-[#FF6A00] tracking-wide">
                Watch Free Animes · {activeSlide.format}
                {activeSlide.seasonYear ? ` · ${activeSlide.seasonYear}` : ''}
                {activeSlide.averageScore ? ` · ${activeSlide.averageScore}% Score` : ''}
              </p>
              <h1
                className="font-display font-extrabold tracking-tight text-white leading-[1.08]"
                style={{ fontSize: 'clamp(1.85rem, 3.8vw, 3.25rem)', textWrap: 'balance' }}
              >
                {activeSlide.titleEnglish || activeSlide.titleRomaji}
              </h1>
              <p className="text-sm sm:text-base text-[#A0A0A0] line-clamp-2 max-w-xl leading-relaxed">
                {activeSlide.synopsis || 'Explore episodes, metadata, and community lists on AniMayX.'}
              </p>

              <div className="pt-2 flex flex-wrap items-center gap-3">
                <Link
                  to={activeSlide.hasAuthorizedPlayback ? `/anime/${activeSlide.id}/watch` : `/anime/${activeSlide.id}`}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#FF6A00] hover:bg-[#FF7E24] text-black text-sm font-semibold transition-colors whitespace-nowrap"
                >
                  <Play className="w-4 h-4 fill-current" />
                  {activeSlide.hasAuthorizedPlayback ? 'Watch Now' : 'View Details'}
                </Link>
                <Link
                  to="/anime/browse"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#121212]/90 border border-white/15 hover:border-white/30 text-white text-sm font-medium transition-colors whitespace-nowrap"
                >
                  Browse Catalogue
                </Link>
              </div>
            </div>

            {activeSlide.posterUrl && (
              <motion.div
                key={`poster_${activeSlide.id}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="hidden md:block shrink-0 mb-4"
              >
                <Link
                  to={`/anime/${activeSlide.id}`}
                  className="block w-40 lg:w-48 aspect-[2/3] rounded-xl overflow-hidden border border-white/15 shadow-2xl bg-[#121212] hover:border-[#FF6A00]/60 transition-colors"
                >
                  <img
                    src={activeSlide.posterUrl}
                    alt={activeSlide.titleEnglish || activeSlide.titleRomaji}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </Link>
              </motion.div>
            )}

            {heroSlides.length > 1 && (
              <div className="absolute bottom-6 right-4 sm:right-8 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setHeroIndex((prev) => (prev - 1 + heroSlides.length) % heroSlides.length)}
                  aria-label="Previous featured title"
                  className="w-9 h-9 rounded-lg bg-[#121212]/80 border border-white/12 flex items-center justify-center text-white hover:border-[#FF6A00] transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono text-[#A0A0A0] px-1.5 tabular-nums">
                  {heroIndex + 1}/{heroSlides.length}
                </span>
                <button
                  type="button"
                  onClick={() => setHeroIndex((prev) => (prev + 1) % heroSlides.length)}
                  aria-label="Next featured title"
                  className="w-9 h-9 rounded-lg bg-[#121212]/80 border border-white/12 flex items-center justify-center text-white hover:border-[#FF6A00] transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </section>
      ) : (
        <section className="relative w-full h-[380px] overflow-hidden border-b border-white/8">
          <img
            src={HERO_KEY_VISUALS[0]}
            alt="AniMayX"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#080808] via-[#080808]/70 to-transparent" />
          <div className="relative z-10 max-w-7xl mx-auto h-full px-4 sm:px-8 flex flex-col justify-end pb-12">
            <h1 className="font-display text-3xl sm:text-5xl font-extrabold text-white">AniMayX</h1>
            <p className="mt-2 text-sm text-[#A0A0A0]">Watch Free Animes · Explore Anime, Cinema, Manga, Light Novels, and Comics.</p>
          </div>
        </section>
      )}

      {/* Continue Watching (Authenticated Users) */}
      {continueWatching.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-8 pt-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl font-bold text-white">Continue Watching</h2>
            <Link to="/anime/watchlist" className="text-xs font-medium text-[#FF6A00] hover:underline inline-flex items-center gap-1">
              Library <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {continueWatching.map((wp) => {
              const pct = wp.durationSeconds > 0 ? Math.min(100, Math.round((wp.positionSeconds / wp.durationSeconds) * 100)) : 0;
              return (
                <Link
                  key={`${wp.animeId}_${wp.episodeNumber}`}
                  to={`/anime/${wp.animeId}/watch?ep=${wp.episodeNumber}`}
                  className="group block rounded-lg bg-[#121212] border border-white/8 overflow-hidden hover:border-[#FF6A00]/50 transition-all duration-200 hover:-translate-y-0.5"
                >
                  <div className="aspect-video relative bg-[#181818] overflow-hidden">
                    {wp.posterUrl && (
                      <img
                        src={wp.posterUrl}
                        alt={wp.animeTitle || wp.animeId}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    )}
                    <div className="absolute inset-x-0 bottom-0 h-1 bg-white/15">
                      <div className="h-full bg-[#FF6A00]" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-medium text-white truncate group-hover:text-[#FF6A00] transition-colors">
                      {wp.animeTitle || wp.animeId}
                    </p>
                    <p className="text-xs text-[#A0A0A0] font-mono tabular-nums mt-0.5">
                      Episode {wp.episodeNumber} · {pct}%
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Category 1: Anime */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8 pt-12">
        <div className="flex items-end justify-between mb-5 gap-4">
          <div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-white">01. Anime</h2>
            <p className="text-xs sm:text-sm text-[#A0A0A0] mt-0.5">
              Trending series synchronized from AniList and Jikan metadata
            </p>
          </div>
          <Link
            to="/anime"
            className="text-xs sm:text-sm font-medium text-[#FF6A00] hover:underline inline-flex items-center gap-1 whitespace-nowrap shrink-0"
          >
            Explore Anime <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {loading ? (
          <PosterGridSkeleton count={10} />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5">
            {trendingAnime.map((item) => (
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
      </section>

      {/* Discord Community Card (Admin-Configurable) */}
      <DiscordHomeCard />

      {/* Category 2: Movies & Web Series */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8 pt-12">
        <div className="flex items-end justify-between mb-5 gap-4">
          <div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-white">02. Movies & Web Series</h2>
            <p className="text-xs sm:text-sm text-[#A0A0A0] mt-0.5">
              Cinema and television catalogue powered by official TMDB metadata
            </p>
          </div>
          <Link
            to="/movies"
            className="text-xs sm:text-sm font-medium text-[#FF6A00] hover:underline inline-flex items-center gap-1 whitespace-nowrap shrink-0"
          >
            Open Movies & TV <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {tmdbConfigured && tmdbItems.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 sm:gap-5">
            {tmdbItems.map((m) => (
              <MediaCard
                key={m.id}
                to={`/movies?id=${m.tmdbId}&type=${m.mediaType}`}
                title={m.title}
                subtitle={m.originalTitle !== m.title ? m.originalTitle : undefined}
                imageUrl={m.posterUrl}
                metaItems={[m.mediaType.toUpperCase(), m.releaseDate?.slice(0, 4), m.voteAverage ? `${m.voteAverage}/10` : null]}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-xl bg-[#121212] border border-white/8 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-[#FF6A00] shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-white">TMDB Provider Pending Configuration</p>
                <p className="text-xs text-[#A0A0A0] mt-0.5">
                  Set TMDB_API_KEY or TMDB_READ_TOKEN in the server environment to activate live movie & series discovery.
                </p>
              </div>
            </div>
            <Link
              to="/movies"
              className="px-4 py-2 rounded-lg border border-white/15 text-xs font-medium text-white hover:border-[#FF6A00] transition-colors whitespace-nowrap"
            >
              Check Status
            </Link>
          </div>
        )}
      </section>

      {/* Category 3: Manga */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8 pt-12">
        <div className="flex items-end justify-between mb-5 gap-4">
          <div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-white">03. Manga</h2>
            <p className="text-xs sm:text-sm text-[#A0A0A0] mt-0.5">
              Multi-language manga catalogue and chapter reader via MangaDex
            </p>
          </div>
          <Link
            to="/manga"
            className="text-xs sm:text-sm font-medium text-[#FF6A00] hover:underline inline-flex items-center gap-1 whitespace-nowrap shrink-0"
          >
            Browse Manga <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {loading ? (
          <PosterGridSkeleton count={5} />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 sm:gap-5">
            {mangaItems.map((m) => (
              <MediaCard
                key={m.id}
                to={`/manga/${m.id}`}
                title={m.title}
                subtitle={m.tags.slice(0, 2).join(' · ')}
                imageUrl={m.coverUrl}
                metaItems={[m.status, m.year]}
              />
            ))}
          </div>
        )}
      </section>

      {/* Category 4: Light Novels */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8 pt-12">
        <div className="flex items-end justify-between mb-5 gap-4">
          <div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-white">04. Light Novels</h2>
            <p className="text-xs sm:text-sm text-[#A0A0A0] mt-0.5">
              Curated light novel volumes and metadata synchronized from AniList
            </p>
          </div>
          <Link
            to="/novels"
            className="text-xs sm:text-sm font-medium text-[#FF6A00] hover:underline inline-flex items-center gap-1 whitespace-nowrap shrink-0"
          >
            Explore Novels <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {loading ? (
          <PosterGridSkeleton count={5} />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 sm:gap-5">
            {novelItems.map((n) => (
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
      </section>

      {/* Category 5: Comics */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8 pt-12">
        <div className="flex items-end justify-between mb-5 gap-4">
          <div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-white">05. Comics</h2>
            <p className="text-xs sm:text-sm text-[#A0A0A0] mt-0.5">
              Western comic volumes and publisher metadata via ComicVine
            </p>
          </div>
          <Link
            to="/comics"
            className="text-xs sm:text-sm font-medium text-[#FF6A00] hover:underline inline-flex items-center gap-1 whitespace-nowrap shrink-0"
          >
            Open Comics <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {comicsConfigured && comicItems.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 sm:gap-5">
            {comicItems.map((c) => (
              <MediaCard
                key={c.id}
                to={`/comics?q=${encodeURIComponent(c.title)}`}
                title={c.title}
                subtitle={c.publisher}
                imageUrl={c.coverUrl}
                metaItems={[c.startYear]}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-xl bg-[#121212] border border-white/8 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-[#FF6A00] shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-white">Comics Provider Not Yet Configured</p>
                <p className="text-xs text-[#A0A0A0] mt-0.5">
                  Configure COMICVINE_API_KEY in server environment variables to enable western comic volume search and metadata.
                </p>
              </div>
            </div>
            <Link
              to="/comics"
              className="px-4 py-2 rounded-lg border border-white/15 text-xs font-medium text-white hover:border-[#FF6A00] transition-colors whitespace-nowrap"
            >
              View Module
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
