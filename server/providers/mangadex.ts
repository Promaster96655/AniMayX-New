import { fetchWithBackoff, getCached, setCached } from './httpClient.ts';

const MANGADEX_BASE = process.env.MANGADEX_API_URL?.trim() || 'https://api.mangadex.org';
const CACHE_TTL = 5 * 60 * 1000;

export interface NormalizedMangaItem {
  id: string;
  mangadexId: string;
  title: string;
  altTitles: string[];
  description: string;
  coverUrl: string;
  status: string;
  year: number | null;
  tags: string[];
  availableLanguages: string[];
  originalLanguage: string;
  provider: 'mangadex';
}

interface MangaDexMangaRaw {
  id: string;
  attributes: {
    title: Record<string, string>;
    altTitles?: Array<Record<string, string>>;
    description?: Record<string, string>;
    status?: string;
    year?: number | null;
    originalLanguage?: string;
    availableTranslatedLanguages?: string[];
    tags?: Array<{ attributes?: { name?: Record<string, string> } }>;
  };
  relationships?: Array<{
    type: string;
    attributes?: { fileName?: string };
  }>;
}

function pickLocalizedText(map?: Record<string, string>): string {
  if (!map) return '';
  return map.en || map['ja-ro'] || Object.values(map)[0] || '';
}

function normalizeMangaDexItem(item: MangaDexMangaRaw): NormalizedMangaItem {
  const coverRel = item.relationships?.find((r) => r.type === 'cover_art');
  const fileName = coverRel?.attributes?.fileName;
  const coverUrl = fileName ? `https://uploads.mangadex.org/covers/${item.id}/${fileName}.512.jpg` : '';

  return {
    id: `mangadex_${item.id}`,
    mangadexId: item.id,
    title: pickLocalizedText(item.attributes.title) || 'Untitled Manga',
    altTitles: (item.attributes.altTitles || []).map(pickLocalizedText).filter(Boolean).slice(0, 4),
    description: pickLocalizedText(item.attributes.description),
    coverUrl,
    status: item.attributes.status || 'ongoing',
    year: item.attributes.year ?? null,
    tags: (item.attributes.tags || []).map((t) => pickLocalizedText(t.attributes?.name)).filter(Boolean).slice(0, 8),
    availableLanguages: item.attributes.availableTranslatedLanguages || [],
    originalLanguage: item.attributes.originalLanguage || 'ja',
    provider: 'mangadex',
  };
}

export async function discoverMangaDex(opts: {
  query?: string;
  language?: string;
  page?: number;
  limit?: number;
}) {
  const limit = Math.min(opts.limit || 20, 40);
  const page = Math.max(1, opts.page || 1);
  const offset = (page - 1) * limit;

  const url = new URL(`${MANGADEX_BASE}/manga`);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('offset', String(offset));
  url.searchParams.append('includes[]', 'cover_art');
  url.searchParams.append('contentRating[]', 'safe');
  url.searchParams.append('contentRating[]', 'suggestive');
  url.searchParams.set('order[followedCount]', 'desc');
  if (opts.query?.trim()) url.searchParams.set('title', opts.query.trim());
  if (opts.language?.trim()) url.searchParams.append('availableTranslatedLanguage[]', opts.language.trim().toLowerCase());

  const cacheKey = `mangadex:discover:${url.toString()}`;
  const cached = getCached<{ items: NormalizedMangaItem[]; total: number }>(cacheKey);
  if (cached) return cached;

  const res = await fetchWithBackoff(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'AniMayX/1.0' },
  });
  if (!res.ok) {
    throw new Error(`MangaDex API HTTP ${res.status}`);
  }

  const json = (await res.json()) as { data?: MangaDexMangaRaw[]; total?: number };
  const result = {
    items: (json.data || []).map(normalizeMangaDexItem),
    total: json.total || 0,
  };
  setCached(cacheKey, result, CACHE_TTL);
  return result;
}

export async function fetchMangaDexById(id: string) {
  const cleanId = id.replace(/^mangadex_/, '');
  const cacheKey = `mangadex:item:${cleanId}`;
  const cached = getCached<NormalizedMangaItem>(cacheKey);
  if (cached) return cached;

  const res = await fetchWithBackoff(`${MANGADEX_BASE}/manga/${encodeURIComponent(cleanId)}?includes[]=cover_art`, {
    headers: { Accept: 'application/json', 'User-Agent': 'AniMayX/1.0' },
  });
  if (!res.ok) {
    throw new Error(`MangaDex item HTTP ${res.status}`);
  }
  const json = (await res.json()) as { data: MangaDexMangaRaw };
  const item = normalizeMangaDexItem(json.data);
  setCached(cacheKey, item, CACHE_TTL);
  return item;
}

export async function fetchMangaDexChapters(mangaId: string, lang = 'en') {
  const cleanId = mangaId.replace(/^mangadex_/, '');
  const url = new URL(`${MANGADEX_BASE}/manga/${encodeURIComponent(cleanId)}/feed`);
  url.searchParams.set('limit', '50');
  url.searchParams.set('order[chapter]', 'asc');
  url.searchParams.append('translatedLanguage[]', lang);
  url.searchParams.append('contentRating[]', 'safe');
  url.searchParams.append('contentRating[]', 'suggestive');

  const cacheKey = `mangadex:chapters:${cleanId}:${lang}`;
  const cached = getCached<Array<{
    id: string;
    chapter: string;
    volume: string;
    title: string;
    pages: number;
    language: string;
    externalUrl: string | null;
    readableInApp: boolean;
  }>>(cacheKey);
  if (cached) return cached;

  const res = await fetchWithBackoff(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'AniMayX/1.0' },
  });
  if (!res.ok) return [];

  const json = (await res.json()) as {
    data?: Array<{
      id: string;
      attributes: {
        chapter?: string | null;
        volume?: string | null;
        title?: string | null;
        pages?: number;
        translatedLanguage?: string;
        externalUrl?: string | null;
      };
    }>;
  };

  const chapters = (json.data || []).map((c) => ({
    id: c.id,
    chapter: c.attributes.chapter || '0',
    volume: c.attributes.volume || '',
    title: c.attributes.title || '',
    pages: c.attributes.pages || 0,
    language: c.attributes.translatedLanguage || lang,
    externalUrl: c.attributes.externalUrl || null,
    readableInApp: !c.attributes.externalUrl && (c.attributes.pages || 0) > 0,
  }));

  setCached(cacheKey, chapters, CACHE_TTL);
  return chapters;
}

export async function fetchMangaDexChapterPages(chapterId: string) {
  const res = await fetchWithBackoff(`${MANGADEX_BASE}/at-home/server/${encodeURIComponent(chapterId)}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'AniMayX/1.0' },
  });
  if (!res.ok) {
    throw new Error(`MangaDex chapter server HTTP ${res.status}`);
  }
  const json = (await res.json()) as {
    baseUrl?: string;
    chapter?: { hash?: string; dataSaver?: string[]; data?: string[] };
  };
  if (!json.baseUrl || !json.chapter?.hash || !json.chapter.data?.length) {
    return { available: false, pages: [] as string[] };
  }
  const pages = json.chapter.data.map(
    (file) => `${json.baseUrl}/data/${json.chapter!.hash}/${file}`
  );
  return { available: true, pages };
}

export function isComicVineConfigured(): boolean {
  return Boolean(process.env.COMICVINE_API_KEY?.trim());
}

export async function discoverComicVine(query = '', page = 1) {
  const apiKey = process.env.COMICVINE_API_KEY?.trim();
  if (!apiKey) {
    return {
      configured: false,
      items: [],
      message: 'Comics provider (ComicVine) is not configured. Add COMICVINE_API_KEY in server environment variables to enable western comics metadata.',
    };
  }

  const url = new URL('https://comicvine.gamespot.com/api/volumes/');
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '20');
  url.searchParams.set('offset', String((Math.max(1, page) - 1) * 20));
  if (query.trim()) {
    url.searchParams.set('filter', `name:${query.trim()}`);
  }

  const res = await fetchWithBackoff(url.toString(), {
    headers: { 'User-Agent': 'AniMayX/1.0' },
  });
  if (!res.ok) {
    throw new Error(`ComicVine API HTTP ${res.status}`);
  }
  const json = (await res.json()) as {
    results?: Array<{
      id: number;
      name: string;
      deck?: string;
      start_year?: string;
      count_of_issues?: number;
      publisher?: { name?: string };
      image?: { medium_url?: string };
    }>;
  };

  return {
    configured: true,
    items: (json.results || []).map((v) => ({
      id: `comicvine_${v.id}`,
      title: v.name,
      description: v.deck || '',
      startYear: v.start_year || '',
      issueCount: v.count_of_issues || 0,
      publisher: v.publisher?.name || 'Unknown Publisher',
      coverUrl: v.image?.medium_url || '',
    })),
    message: null,
  };
}
