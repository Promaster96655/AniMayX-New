import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Bookmark, Check, Play, AlertCircle, Film } from 'lucide-react';
import { apiGet, apiPost } from '../lib/apiClient';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  getFirestoreAnimeById,
  getUserWatchProgress,
  getUserWatchlist,
  listEpisodesForAnime,
  removeWatchlistEntry,
  saveWatchProgress,
  upsertWatchlistEntry,
} from '../lib/firestoreService';
import type { AniSkipResult, AnimeItem, EpisodeItem, PlaybackSource, SubtitleTrack, WatchlistEntry } from '../lib/types';
import { HERO_KEY_VISUALS } from '../lib/presets';
import { VideoPlayer } from '../components/VideoPlayer';

interface JikanEp {
  episodeNumber: number;
  title: string;
  japaneseTitle?: string;
  aired?: string;
  filler: boolean;
}

interface ConsumetEpisode {
  id: string;
  number: number;
  title?: string;
  image?: string;
}

export function AnimeDetailPage({ watchMode = false }: { watchMode?: boolean }) {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, profile, privateInfo } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [anime, setAnime] = useState<AnimeItem | null>(null);
  const [jikanEps, setJikanEps] = useState<JikanEp[]>([]);
  const [firestoreEps, setFirestoreEps] = useState<EpisodeItem[]>([]);
  const [watchlistStatus, setWatchlistStatus] = useState<WatchlistEntry['watchStatus'] | null>(null);
  const [aniSkip, setAniSkip] = useState<AniSkipResult | null>(null);
  const [resumeSeconds, setResumeSeconds] = useState(0);
  const [resolvedValidUrl, setResolvedValidUrl] = useState<boolean>(true);
  const [consumetConfigured, setConsumetConfigured] = useState(false);
  const [consumetEps, setConsumetEps] = useState<ConsumetEpisode[]>([]);
  const [consumetSources, setConsumetSources] = useState<PlaybackSource[]>([]);
  const [consumetSubtitles, setConsumetSubtitles] = useState<SubtitleTrack[]>([]);
  const [bannerLoaded, setBannerLoaded] = useState(false);

  const selectedEpNum = Number(searchParams.get('ep') || 1);

  useEffect(() => {
    if (!id) return;
    let active = true;

    async function load() {
      setLoading(true);
      try {
        const fsItem = await getFirestoreAnimeById(id!).catch(() => null);
        const fsEpisodes = await listEpisodesForAnime(id!, false).catch(() => []);

        let apiAnime: AnimeItem | null = null;
        let jikanList: JikanEp[] = [];

        if (id!.startsWith('anilist_') || /^\d+$/.test(id!)) {
          const res = await apiGet<{ anime: AnimeItem; jikanEpisodes: JikanEp[] }>(`/api/anime/${id}`).catch(
            () => null
          );
          if (res) {
            apiAnime = res.anime;
            jikanList = res.jikanEpisodes || [];
          }
        }

        if (!active) return;
        const combined = fsItem
          ? { ...apiAnime, ...fsItem, studios: fsItem.studios || apiAnime?.studios }
          : apiAnime;
        setAnime(combined);
        setFirestoreEps(fsEpisodes);
        setJikanEps(jikanList);

        // Also check Consumet Meta AniList endpoint when configured
        const numericId = id!.replace(/^anilist_/, '');
        if (/^\d+$/.test(numericId)) {
          const consumetInfo = await apiGet<{
            configured: boolean;
            info?: { episodes?: ConsumetEpisode[] } | null;
          }>(`/api/consumet/meta/anilist/info/${numericId}`).catch(() => ({
            configured: false,
            info: null,
          }));
          if (active) {
            setConsumetConfigured(Boolean(consumetInfo.configured));
            setConsumetEps(Array.isArray(consumetInfo.info?.episodes) ? consumetInfo.info!.episodes! : []);
          }
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [id]);

  // Load watchlist & progress
  useEffect(() => {
    if (!user || !id) {
      setWatchlistStatus(null);
      return;
    }
    getUserWatchlist(user.uid)
      .then((list) => {
        const match = list.find((item) => item.mediaId === id);
        setWatchlistStatus(match?.watchStatus || null);
      })
      .catch(() => {});

    if (watchMode) {
      getUserWatchProgress(user.uid)
        .then((progress) => {
          const match = progress.find((p) => p.animeId === id && p.episodeNumber === selectedEpNum);
          setResumeSeconds(match && !match.completed ? match.positionSeconds : 0);
        })
        .catch(() => {});
    }
  }, [user, id, watchMode, selectedEpNum]);

  // Fetch AniSkip when in watchMode & malId available
  useEffect(() => {
    if (!watchMode || !anime?.malId) {
      setAniSkip(null);
      return;
    }
    apiGet<AniSkipResult>(`/api/aniskip/${anime.malId}/${selectedEpNum}`)
      .then(setAniSkip)
      .catch(() => setAniSkip(null));
  }, [watchMode, anime?.malId, selectedEpNum]);

  const activeEpisode = firestoreEps.find((ep) => ep.episodeNumber === selectedEpNum) || null;
  const activeConsumetEp = consumetEps.find((ep) => Number(ep.number) === selectedEpNum) || null;

  useEffect(() => {
    if (!watchMode || (activeEpisode?.playbackSources?.length || 0) > 0 || !consumetConfigured || !activeConsumetEp?.id) {
      setConsumetSources([]);
      setConsumetSubtitles([]);
      return;
    }
    let active = true;
    apiGet<{
      configured: boolean;
      sources?: Array<{ url: string; quality?: string; isM3U8?: boolean }>;
      subtitles?: Array<{ url: string; lang: string }>;
    }>(`/api/consumet/meta/anilist/watch/${encodeURIComponent(activeConsumetEp.id)}`)
      .then((res) => {
        if (!active) return;
        const mappedSources: PlaybackSource[] = (res.sources || [])
          .filter((s) => typeof s.url === 'string' && s.url.startsWith('https://'))
          .map((s, idx) => ({
            id: `consumet_${idx}`,
            label: s.quality || 'Consumet Stream',
            url: s.url,
            type: s.isM3U8 || s.url.includes('.m3u8') ? 'hls' : 'mp4',
            quality: (['360p', '480p', '720p', '1080p'].includes(s.quality || '') ? s.quality : 'auto') as PlaybackSource['quality'],
            language: 'Japanese',
            audioTrack: 'Original',
          }));
        const mappedSubs: SubtitleTrack[] = (res.subtitles || [])
          .filter((sub) => typeof sub.url === 'string' && sub.url.startsWith('https://'))
          .map((sub, idx) => ({
            id: `csub_${idx}`,
            label: sub.lang || `Subtitle ${idx + 1}`,
            lang: (sub.lang || 'en').slice(0, 2).toLowerCase(),
            url: sub.url,
            format: 'vtt',
            isDefault: idx === 0,
          }));
        setConsumetSources(mappedSources);
        setConsumetSubtitles(mappedSubs);
      })
      .catch(() => {
        if (active) {
          setConsumetSources([]);
          setConsumetSubtitles([]);
        }
      });
    return () => {
      active = false;
    };
  }, [watchMode, activeEpisode, consumetConfigured, activeConsumetEp]);

  const playableSources =
    (activeEpisode?.playbackSources?.length || 0) > 0 ? activeEpisode!.playbackSources : consumetSources;
  const effectiveSubtitles =
    (activeEpisode?.subtitles?.length || 0) > 0 ? activeEpisode!.subtitles : consumetSubtitles;
  const hasPlayableSource = playableSources.length > 0;
  const firstPlayableUrl = playableSources[0]?.url || '';
  const firstPlayableType = playableSources[0]?.type || '';

  useEffect(() => {
    if (!watchMode || !firstPlayableUrl) {
      setResolvedValidUrl(true);
      return;
    }
    apiPost<{ valid: boolean }>('/api/playback/resolve', {
      url: firstPlayableUrl,
      type: firstPlayableType,
    })
      .then((res) => setResolvedValidUrl(res.valid))
      .catch(() => setResolvedValidUrl(false));
  }, [watchMode, firstPlayableUrl, firstPlayableType]);

  const handleWatchlistChange = async (status: WatchlistEntry['watchStatus'] | 'remove') => {
    if (!user || !anime) {
      showToast('Sign in required', 'warning', 'Sign in to manage your personal watchlist.');
      return;
    }
    if (!user.emailVerified) {
      showToast('Verify your email', 'warning', 'Email verification is required to save watchlist items.');
      return;
    }
    try {
      if (status === 'remove') {
        await removeWatchlistEntry(user.uid, anime.id);
        setWatchlistStatus(null);
        showToast('Removed from watchlist', 'info');
      } else {
        await upsertWatchlistEntry({
          userId: user.uid,
          mediaId: anime.id,
          category: anime.format === 'MOVIE' ? 'anime_movie' : 'anime',
          title: anime.titleEnglish || anime.titleRomaji,
          posterUrl: anime.posterUrl,
          watchStatus: status,
          isPublic: profile?.watchlistVisibility !== 'private',
        });
        setWatchlistStatus(status);
        showToast('Watchlist updated', 'success');
      }
    } catch (err) {
      showToast('Watchlist error', 'error', err instanceof Error ? err.message : 'Unable to update watchlist.');
    }
  };

  if (loading) {
    return <div className="max-w-6xl mx-auto px-4 py-16 text-sm text-[#A0A0A0]">Loading anime details...</div>;
  }

  if (!anime) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center space-y-3">
        <h1 className="font-display text-2xl font-bold text-white">Title Not Found</h1>
        <Link to="/anime/browse" className="text-sm text-[#FF6A00] hover:underline">
          Browse Anime Catalogue
        </Link>
      </div>
    );
  }

  const primaryTitle = anime.titleEnglish || anime.titleRomaji;
  const maxEpisodes = Math.max(
    firestoreEps.length,
    consumetEps.length,
    jikanEps.length,
    anime.episodeCount || 0
  );

  const mergedEpisodes = Array.from({ length: Math.min(maxEpisodes, 100) }).map((_, idx) => {
    const num = idx + 1;
    const fsEp = firestoreEps.find((e) => e.episodeNumber === num);
    const cEp = consumetEps.find((e) => Number(e.number) === num);
    const jEp = jikanEps.find((e) => e.episodeNumber === num);
    return {
      episodeNumber: num,
      title: fsEp?.title || cEp?.title || jEp?.title || `Episode ${num}`,
      description: fsEp?.description || '',
      hasSources: Boolean((fsEp && fsEp.playbackSources?.length > 0) || cEp?.id),
      filler: jEp?.filler || false,
    };
  });

  const anyEpisodePlayable =
    firestoreEps.some((e) => (e.playbackSources?.length || 0) > 0) || consumetEps.length > 0;

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      {/* Watch Player Stage when in watchMode */}
      {watchMode && (
        <div className="bg-[#050505] border-b border-white/8 py-6">
          <div className="max-w-6xl mx-auto px-4 sm:px-8 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <Link to={`/anime/${anime.id}`} className="text-xs text-[#FF6A00] hover:underline">
                  Back to {primaryTitle}
                </Link>
                <h1 className="font-display text-lg sm:text-xl font-bold text-white mt-0.5">
                  Episode {selectedEpNum}
                  {activeEpisode?.title ? ` — ${activeEpisode.title}` : ''}
                </h1>
              </div>
            </div>

            {hasPlayableSource && resolvedValidUrl ? (
              <VideoPlayer
                sources={playableSources}
                subtitles={effectiveSubtitles}
                posterUrl={activeEpisode?.thumbnailUrl || anime.bannerUrl || anime.posterUrl}
                initialTimeSeconds={resumeSeconds}
                aniSkip={aniSkip}
                skipEnabled={privateInfo?.skipIntroEnabled !== false}
                hasNextEpisode={
                  firestoreEps.some((e) => e.episodeNumber === selectedEpNum + 1) ||
                  consumetEps.some((e) => Number(e.number) === selectedEpNum + 1)
                }
                onNextEpisode={() => {
                  const next = selectedEpNum + 1;
                  setSearchParams({ ep: String(next) });
                }}
                onProgressTick={(pos, dur, completed) => {
                  if (!user || !user.emailVerified) return;
                  saveWatchProgress({
                    userId: user.uid,
                    animeId: anime.id,
                    animeTitle: primaryTitle,
                    posterUrl: anime.posterUrl,
                    episodeNumber: selectedEpNum,
                    positionSeconds: pos,
                    durationSeconds: dur,
                    completed,
                  }).catch(() => {});
                }}
              />
            ) : (
              <div className="rounded-xl bg-[#121212] border border-white/10 p-8 text-center space-y-2">
                <AlertCircle className="w-8 h-8 text-[#FF6A00] mx-auto" />
                <h2 className="font-display text-lg font-semibold text-white">
                  Playback Source Not Configured for Episode {selectedEpNum}
                </h2>
                <p className="text-xs text-[#A0A0A0] max-w-lg mx-auto">
                  Metadata is available from AniList/Jikan, but AniMayX only streams when an administrator configures an authorized HTTPS HLS or MP4 source.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Detail Banner */}
      {!watchMode && (
        <div className="relative h-64 sm:h-80 border-b border-white/8 overflow-hidden bg-[#0C0C0C]">
          {anime.bannerUrl ? (
            <img
              src={anime.bannerUrl}
              alt={primaryTitle}
              referrerPolicy="no-referrer"
              onLoad={() => setBannerLoaded(true)}
              className={`w-full h-full object-cover object-center transition-opacity duration-500 ${
                bannerLoaded ? 'opacity-100' : 'opacity-0'
              }`}
            />
          ) : (
            <>
              <img
                src={HERO_KEY_VISUALS[0]}
                alt=""
                aria-hidden="true"
                className="w-full h-full object-cover object-center opacity-35"
              />
              {anime.posterUrl && (
                <img
                  src={anime.posterUrl}
                  alt=""
                  aria-hidden="true"
                  referrerPolicy="no-referrer"
                  className="absolute inset-0 w-full h-full object-cover object-center opacity-40 blur-2xl scale-110 pointer-events-none"
                />
              )}
            </>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#080808] via-[#080808]/65 to-[#080808]/25" />
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8">
        <div className={`flex flex-col md:flex-row gap-8 ${!watchMode ? '-mt-28 relative z-10' : ''}`}>
          {/* Poster */}
          <div className="w-44 sm:w-52 shrink-0">
            <div className="aspect-[2/3] rounded-xl overflow-hidden bg-[#121212] border border-white/12 shadow-2xl">
              {anime.posterUrl ? (
                <img
                  src={anime.posterUrl}
                  alt={primaryTitle}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Film className="w-8 h-8 text-[#FF6A00]" />
                </div>
              )}
            </div>
          </div>

          {/* Titles, Metadata, Actions */}
          <div className="flex-1 space-y-4">
            <div>
              <p className="text-xs font-medium text-[#FF6A00]">
                {anime.format}
                {anime.seasonYear ? ` · ${anime.season || ''} ${anime.seasonYear}` : ''}
                {anime.averageScore ? ` · ${anime.averageScore}% Score` : ''}
                {anime.episodeCount ? ` · ${anime.episodeCount} Episodes` : ''}
              </p>
              <h1 className="font-display text-2xl sm:text-4xl font-extrabold text-white mt-1">
                {primaryTitle}
              </h1>
              {(anime.titleRomaji !== primaryTitle || anime.titleNative) && (
                <p className="text-xs text-[#A0A0A0] mt-1">
                  {[anime.titleRomaji !== primaryTitle ? anime.titleRomaji : null, anime.titleNative]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {anyEpisodePlayable && !watchMode && (
                <button
                  type="button"
                  onClick={() => {
                    const firstPlayable = firestoreEps.find((e) => e.playbackSources?.length > 0);
                    const firstEp = firstPlayable?.episodeNumber || consumetEps[0]?.number || 1;
                    navigate(`/anime/${anime.id}/watch?ep=${firstEp}`);
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#FF6A00] hover:bg-[#FF7E24] text-black text-sm font-semibold transition-colors"
                >
                  <Play className="w-4 h-4 fill-current" />
                  Watch Episode
                </button>
              )}

              <div className="inline-flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-[#FF6A00]" />
                <select
                  value={watchlistStatus || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val) handleWatchlistChange(val as WatchlistEntry['watchStatus'] | 'remove');
                  }}
                  className="h-10 px-3 rounded-lg bg-[#121212] border border-white/15 text-xs font-medium text-white"
                >
                  <option value="">Add to Watchlist...</option>
                  <option value="watching">Watching</option>
                  <option value="planned">Plan to Watch</option>
                  <option value="completed">Completed</option>
                  <option value="on_hold">On Hold</option>
                  <option value="dropped">Dropped</option>
                  {watchlistStatus && <option value="remove">Remove from Watchlist</option>}
                </select>
                {watchlistStatus && <Check className="w-4 h-4 text-emerald-400" />}
              </div>
            </div>

            <p className="text-sm text-[#A0A0A0] leading-relaxed whitespace-pre-line">
              {anime.synopsis || 'No synopsis provided by the metadata source.'}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs text-[#A0A0A0] border-t border-white/8">
              <div>
                <span className="text-white font-medium">Genres:</span>{' '}
                {anime.genres.length > 0 ? anime.genres.join(', ') : 'Uncategorized'}
              </div>
              <div>
                <span className="text-white font-medium">Languages:</span>{' '}
                {anime.languages.length > 0 ? anime.languages.join(', ') : 'Japanese'}
              </div>
              {anime.studios && anime.studios.length > 0 && (
                <div>
                  <span className="text-white font-medium">Studios:</span> {anime.studios.join(', ')}
                </div>
              )}
              <div>
                <span className="text-white font-medium">Source:</span>{' '}
                {anime.sourceProvider.toUpperCase()}
                {anime.malId ? ` (MAL #${anime.malId})` : ''}
              </div>
            </div>
          </div>
        </div>

        {/* Episodes Directory */}
        <section className="mt-12 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold text-white">Episodes</h2>
            {!anyEpisodePlayable && (
              <span className="text-xs text-[#A0A0A0]">
                Metadata only — no authorized playback streams configured yet
              </span>
            )}
          </div>

          {mergedEpisodes.length === 0 ? (
            <div className="rounded-xl bg-[#121212] border border-white/8 p-6 text-sm text-[#A0A0A0]">
              No episode records available yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {mergedEpisodes.map((ep) => (
                <div
                  key={ep.episodeNumber}
                  className={`rounded-lg p-3.5 border flex items-center justify-between gap-3 ${
                    watchMode && selectedEpNum === ep.episodeNumber
                      ? 'bg-[#181818] border-[#FF6A00]'
                      : 'bg-[#121212] border-white/8'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-xs font-mono text-[#FF6A00] tabular-nums">
                      EP {String(ep.episodeNumber).padStart(2, '0')}
                      {ep.filler ? ' · Filler' : ''}
                    </p>
                    <p className="text-sm font-medium text-white truncate mt-0.5">{ep.title}</p>
                  </div>

                  {ep.hasSources ? (
                    <Link
                      to={`/anime/${anime.id}/watch?ep=${ep.episodeNumber}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FF6A00] hover:bg-[#FF7E24] text-black text-xs font-semibold shrink-0"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      Watch
                    </Link>
                  ) : (
                    <span className="text-[11px] text-[#A0A0A0] shrink-0">No Stream</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
