import { fetchWithBackoff, getCached, setCached } from './httpClient.ts';

const JIKAN_BASE = 'https://api.jikan.moe/v4';
const CACHE_TTL = 10 * 60 * 1000;

let lastJikanCallAt = 0;

async function rateLimitedJikanFetch(url: string): Promise<Response> {
  const now = Date.now();
  const elapsed = now - lastJikanCallAt;
  if (elapsed < 400) {
    await new Promise((r) => setTimeout(r, 400 - elapsed));
  }
  lastJikanCallAt = Date.now();
  return fetchWithBackoff(url, { headers: { Accept: 'application/json' } });
}

export interface JikanEpisodeSummary {
  episodeNumber: number;
  title: string;
  japaneseTitle?: string;
  aired?: string;
  filler: boolean;
  recap: boolean;
}

export async function fetchJikanAnimeEpisodes(malId: number, page = 1): Promise<{
  episodes: JikanEpisodeSummary[];
  hasNextPage: boolean;
}> {
  if (!Number.isFinite(malId) || malId <= 0) {
    return { episodes: [], hasNextPage: false };
  }

  const cacheKey = `jikan:episodes:${malId}:${page}`;
  const cached = getCached<{ episodes: JikanEpisodeSummary[]; hasNextPage: boolean }>(cacheKey);
  if (cached) return cached;

  const res = await rateLimitedJikanFetch(`${JIKAN_BASE}/anime/${malId}/episodes?page=${page}`);
  if (!res.ok) {
    if (res.status === 404) {
      return { episodes: [], hasNextPage: false };
    }
    throw new Error(`Jikan API HTTP ${res.status}`);
  }

  const json = (await res.json()) as {
    pagination?: { has_next_page?: boolean };
    data?: Array<{
      mal_id: number;
      title?: string;
      title_japanese?: string;
      aired?: string;
      filler?: boolean;
      recap?: boolean;
    }>;
  };

  const result = {
    episodes: (json.data || []).map((ep) => ({
      episodeNumber: ep.mal_id,
      title: ep.title || `Episode ${ep.mal_id}`,
      japaneseTitle: ep.title_japanese || undefined,
      aired: ep.aired || undefined,
      filler: Boolean(ep.filler),
      recap: Boolean(ep.recap),
    })),
    hasNextPage: Boolean(json.pagination?.has_next_page),
  };

  setCached(cacheKey, result, CACHE_TTL);
  return result;
}

export async function fetchJikanAnimeDetails(malId: number) {
  if (!Number.isFinite(malId) || malId <= 0) return null;
  const cacheKey = `jikan:details:${malId}`;
  const cached = getCached<Record<string, unknown>>(cacheKey);
  if (cached) return cached;

  const res = await rateLimitedJikanFetch(`${JIKAN_BASE}/anime/${malId}`);
  if (!res.ok) return null;
  const json = (await res.json()) as { data?: Record<string, unknown> };
  if (!json.data) return null;

  setCached(cacheKey, json.data, CACHE_TTL);
  return json.data;
}
