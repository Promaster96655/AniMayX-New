import { fetchWithBackoff, getCached, isSafePublicHttpsUrl, setCached } from './httpClient.ts';

const CACHE_TTL = 4 * 60 * 1000;

let runtimeConsumetUrl = (process.env.CONSUMET_API_URL || '').trim().replace(/\/+$/, '');
const requestTimestamps: number[] = [];

export function getConsumetBaseUrl(): string {
  return runtimeConsumetUrl;
}

export function setRuntimeConsumetUrl(url: string): void {
  const cleaned = url.trim().replace(/\/+$/, '');
  if (!cleaned) {
    runtimeConsumetUrl = '';
    return;
  }
  if (!isSafePublicHttpsUrl(cleaned)) {
    throw new Error('Consumet API URL must be a valid public HTTP/HTTPS endpoint.');
  }
  runtimeConsumetUrl = cleaned;
}

export function isConsumetConfigured(): boolean {
  return Boolean(runtimeConsumetUrl);
}

async function consumetFetch<T>(apiPath: string): Promise<T> {
  if (!runtimeConsumetUrl) {
    throw new Error('CONSUMET_API_URL is not configured');
  }

  // Respect Consumet FastifyRateLimit (max 90 req / 60s)
  const now = Date.now();
  while (requestTimestamps.length > 0 && now - requestTimestamps[0] > 60_000) {
    requestTimestamps.shift();
  }
  if (requestTimestamps.length >= 85) {
    throw new Error('Consumet rate-limit guard active (85/90 requests per minute). Please wait a few seconds.');
  }
  requestTimestamps.push(now);

  const url = `${runtimeConsumetUrl}${apiPath.startsWith('/') ? apiPath : `/${apiPath}`}`;
  const cacheKey = `consumet:${url}`;
  const cached = getCached<T>(cacheKey);
  if (cached) return cached;

  const res = await fetchWithBackoff(url, {
    headers: { Accept: 'application/json' },
  }, 2, 500);

  if (!res.ok) {
    throw new Error(`Consumet API HTTP ${res.status}`);
  }

  const data = (await res.json()) as T;
  setCached(cacheKey, data, CACHE_TTL);
  return data;
}

// 1. /meta/anilist
export async function consumetMetaSearch(query: string, page = 1) {
  return consumetFetch<{ results?: Array<Record<string, unknown>>; hasNextPage?: boolean }>(
    `/meta/anilist/${encodeURIComponent(query)}?page=${page}`
  );
}

export async function consumetMetaTrending(page = 1) {
  return consumetFetch<{ results?: Array<Record<string, unknown>>; hasNextPage?: boolean }>(
    `/meta/anilist/trending?page=${page}`
  );
}

export async function consumetMetaInfo(id: string, provider = 'gogoanime') {
  return consumetFetch<Record<string, unknown>>(
    `/meta/anilist/info/${encodeURIComponent(id)}?provider=${encodeURIComponent(provider)}`
  );
}

export async function consumetMetaWatch(episodeId: string, provider = 'gogoanime') {
  return consumetFetch<{
    sources?: Array<{ url: string; quality?: string; isM3U8?: boolean }>;
    subtitles?: Array<{ url: string; lang: string }>;
    headers?: Record<string, string>;
  }>(`/meta/anilist/watch/${encodeURIComponent(episodeId)}?provider=${encodeURIComponent(provider)}`);
}

// 2. /anime/:provider
export async function consumetAnimeSearch(provider: string, query: string, page = 1) {
  return consumetFetch<{ results?: Array<Record<string, unknown>>; hasNextPage?: boolean }>(
    `/anime/${encodeURIComponent(provider)}/${encodeURIComponent(query)}?page=${page}`
  );
}

export async function consumetAnimeInfo(provider: string, id: string) {
  return consumetFetch<Record<string, unknown>>(
    `/anime/${encodeURIComponent(provider)}/info?id=${encodeURIComponent(id)}`
  );
}

export async function consumetAnimeWatch(provider: string, episodeId: string) {
  return consumetFetch<{
    sources?: Array<{ url: string; quality?: string; isM3U8?: boolean }>;
    subtitles?: Array<{ url: string; lang: string }>;
  }>(`/anime/${encodeURIComponent(provider)}/watch/${encodeURIComponent(episodeId)}`);
}

// 3. /manga/:provider
export async function consumetMangaSearch(provider: string, query: string) {
  return consumetFetch<{ results?: Array<Record<string, unknown>> }>(
    `/manga/${encodeURIComponent(provider)}/${encodeURIComponent(query)}`
  );
}

export async function consumetMangaInfo(provider: string, id: string) {
  return consumetFetch<Record<string, unknown>>(
    `/manga/${encodeURIComponent(provider)}/info?id=${encodeURIComponent(id)}`
  );
}

export async function consumetMangaRead(provider: string, chapterId: string) {
  return consumetFetch<Array<{ img: string; page: number }>>(
    `/manga/${encodeURIComponent(provider)}/read?chapterId=${encodeURIComponent(chapterId)}`
  );
}

// 4. /movies/:provider
export async function consumetMoviesSearch(provider: string, query: string, page = 1) {
  return consumetFetch<{ results?: Array<Record<string, unknown>>; hasNextPage?: boolean }>(
    `/movies/${encodeURIComponent(provider)}/${encodeURIComponent(query)}?page=${page}`
  );
}

export async function consumetMoviesInfo(provider: string, id: string) {
  return consumetFetch<Record<string, unknown>>(
    `/movies/${encodeURIComponent(provider)}/info?id=${encodeURIComponent(id)}`
  );
}

export async function consumetMoviesWatch(provider: string, episodeId: string, mediaId: string) {
  return consumetFetch<{
    sources?: Array<{ url: string; quality?: string; isM3U8?: boolean }>;
    subtitles?: Array<{ url: string; lang: string }>;
  }>(
    `/movies/${encodeURIComponent(provider)}/watch?episodeId=${encodeURIComponent(episodeId)}&mediaId=${encodeURIComponent(mediaId)}`
  );
}

// 5. /light-novels/:provider
export async function consumetNovelsSearch(provider: string, query: string) {
  return consumetFetch<{ results?: Array<Record<string, unknown>> }>(
    `/light-novels/${encodeURIComponent(provider)}/${encodeURIComponent(query)}`
  );
}

export async function consumetNovelsInfo(provider: string, id: string) {
  return consumetFetch<Record<string, unknown>>(
    `/light-novels/${encodeURIComponent(provider)}/info?id=${encodeURIComponent(id)}`
  );
}

export async function consumetNovelsRead(provider: string, chapterId: string) {
  return consumetFetch<Record<string, unknown>>(
    `/light-novels/${encodeURIComponent(provider)}/read?chapterId=${encodeURIComponent(chapterId)}`
  );
}

// 6. /comics
export async function consumetComicsSearch(comicTitle: string) {
  return consumetFetch<Record<string, unknown>>(
    `/comics/s?comicTitle=${encodeURIComponent(comicTitle)}`
  );
}

// 7. /books
export async function consumetBooksSearch(query: string) {
  return consumetFetch<Record<string, unknown>>(
    `/books/s?query=${encodeURIComponent(query)}`
  );
}
