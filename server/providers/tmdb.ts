import { fetchWithBackoff, getCached, setCached } from './httpClient.ts';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMG_POSTER = 'https://image.tmdb.org/t/p/w500';
const TMDB_IMG_BACKDROP = 'https://image.tmdb.org/t/p/w1280';
const CACHE_TTL = 5 * 60 * 1000;

export function isTmdbConfigured(): boolean {
  return Boolean(process.env.TMDB_READ_TOKEN?.trim() || process.env.TMDB_API_KEY?.trim());
}

async function tmdbFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const token = process.env.TMDB_READ_TOKEN?.trim();
  const apiKey = process.env.TMDB_API_KEY?.trim();

  if (!token && !apiKey) {
    throw new Error('TMDB credentials not configured');
  }

  const url = new URL(`${TMDB_BASE}${endpoint}`);
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v);
  }
  if (!token && apiKey) {
    url.searchParams.set('api_key', apiKey);
  }

  const cacheKey = `tmdb:${url.pathname}?${url.searchParams.toString()}`;
  const cached = getCached<T>(cacheKey);
  if (cached) return cached;

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetchWithBackoff(url.toString(), { headers });
  if (!res.ok) {
    throw new Error(`TMDB API HTTP ${res.status}`);
  }

  const data = (await res.json()) as T;
  setCached(cacheKey, data, CACHE_TTL);
  return data;
}

export interface NormalizedTmdbItem {
  id: string;
  tmdbId: number;
  mediaType: 'movie' | 'tv';
  title: string;
  originalTitle: string;
  overview: string;
  posterUrl: string;
  backdropUrl: string;
  releaseDate: string;
  originalLanguage: string;
  voteAverage: number;
  popularity: number;
  genreIds: number[];
  hasAuthorizedPlayback: false;
  attribution: string;
}

interface TmdbRawItem {
  id: number;
  media_type?: 'movie' | 'tv';
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  original_language?: string;
  vote_average?: number;
  popularity?: number;
  genre_ids?: number[];
}

function normalizeTmdbItem(item: TmdbRawItem, fallbackType: 'movie' | 'tv'): NormalizedTmdbItem {
  const mediaType = item.media_type === 'tv' || item.media_type === 'movie' ? item.media_type : fallbackType;
  return {
    id: `tmdb_${mediaType}_${item.id}`,
    tmdbId: item.id,
    mediaType,
    title: item.title || item.name || 'Untitled',
    originalTitle: item.original_title || item.original_name || item.title || item.name || '',
    overview: item.overview || '',
    posterUrl: item.poster_path ? `${TMDB_IMG_POSTER}${item.poster_path}` : '',
    backdropUrl: item.backdrop_path ? `${TMDB_IMG_BACKDROP}${item.backdrop_path}` : '',
    releaseDate: item.release_date || item.first_air_date || '',
    originalLanguage: (item.original_language || 'en').toUpperCase(),
    voteAverage: typeof item.vote_average === 'number' ? Number(item.vote_average.toFixed(1)) : 0,
    popularity: item.popularity || 0,
    genreIds: item.genre_ids || [],
    hasAuthorizedPlayback: false,
    attribution: 'Metadata provided by TMDB',
  };
}

export async function discoverTmdb(opts: {
  mediaType?: 'movie' | 'tv';
  query?: string;
  genre?: string;
  language?: string;
  region?: string;
  sortBy?: string;
  page?: number;
}) {
  if (!isTmdbConfigured()) {
    return {
      configured: false,
      items: [] as NormalizedTmdbItem[],
      page: 1,
      totalPages: 0,
      message: 'TMDB provider is not configured. Add TMDB_API_KEY or TMDB_READ_TOKEN in server environment variables.',
    };
  }

  const mediaType = opts.mediaType === 'tv' ? 'tv' : 'movie';
  const page = String(Math.max(1, opts.page || 1));

  if (opts.query?.trim()) {
    const data = await tmdbFetch<{ page: number; total_pages: number; results: TmdbRawItem[] }>(
      `/search/${mediaType}`,
      {
        query: opts.query.trim(),
        page,
        include_adult: 'false',
        ...(opts.language ? { language: opts.language } : {}),
        ...(opts.region ? { region: opts.region } : {}),
      }
    );
    return {
      configured: true,
      items: (data.results || []).map((r) => normalizeTmdbItem(r, mediaType)),
      page: data.page || 1,
      totalPages: Math.min(data.total_pages || 1, 500),
      message: null,
    };
  }

  const endpoint = opts.sortBy === 'trending' ? `/trending/${mediaType}/week` : `/discover/${mediaType}`;
  const params: Record<string, string> = {
    page,
    include_adult: 'false',
  };
  if (endpoint.startsWith('/discover')) {
    params.sort_by = opts.sortBy === 'rating' ? 'vote_average.desc' : 'popularity.desc';
    if (opts.genre) params.with_genres = opts.genre;
    if (opts.language) params.with_original_language = opts.language.split('-')[0];
    if (opts.region) params.region = opts.region;
  }

  const data = await tmdbFetch<{ page: number; total_pages: number; results: TmdbRawItem[] }>(endpoint, params);
  return {
    configured: true,
    items: (data.results || []).map((r) => normalizeTmdbItem(r, mediaType)),
    page: data.page || 1,
    totalPages: Math.min(data.total_pages || 1, 500),
    message: null,
  };
}

export async function fetchTmdbGenres(mediaType: 'movie' | 'tv') {
  if (!isTmdbConfigured()) {
    return { configured: false, genres: [] as Array<{ id: number; name: string }> };
  }
  const data = await tmdbFetch<{ genres: Array<{ id: number; name: string }> }>(`/genre/${mediaType}/list`);
  return { configured: true, genres: data.genres || [] };
}

export async function fetchTmdbDetails(mediaType: 'movie' | 'tv', id: number) {
  if (!isTmdbConfigured()) {
    return { configured: false, item: null };
  }
  const data = await tmdbFetch<Record<string, unknown>>(`/${mediaType}/${id}`, {
    append_to_response: 'credits,videos',
  });
  return {
    configured: true,
    item: {
      id: `tmdb_${mediaType}_${id}`,
      tmdbId: id,
      mediaType,
      title: (data.title || data.name || 'Untitled') as string,
      originalTitle: (data.original_title || data.original_name || '') as string,
      overview: (data.overview || '') as string,
      posterUrl: data.poster_path ? `${TMDB_IMG_POSTER}${data.poster_path}` : '',
      backdropUrl: data.backdrop_path ? `${TMDB_IMG_BACKDROP}${data.backdrop_path}` : '',
      releaseDate: (data.release_date || data.first_air_date || '') as string,
      runtime: (data.runtime || (Array.isArray(data.episode_run_time) ? data.episode_run_time[0] : null)) as number | null,
      voteAverage: typeof data.vote_average === 'number' ? Number(data.vote_average.toFixed(1)) : 0,
      genres: Array.isArray(data.genres) ? (data.genres as Array<{ id: number; name: string }>).map((g) => g.name) : [],
      spokenLanguages: Array.isArray(data.spoken_languages)
        ? (data.spoken_languages as Array<{ english_name?: string; iso_639_1: string }>).map((l) => l.english_name || l.iso_639_1)
        : [],
      seasonsCount: typeof data.number_of_seasons === 'number' ? data.number_of_seasons : undefined,
      episodesCount: typeof data.number_of_episodes === 'number' ? data.number_of_episodes : undefined,
      hasAuthorizedPlayback: false,
      attribution: 'This product uses the TMDB API but is not endorsed or certified by TMDB.',
    },
  };
}
