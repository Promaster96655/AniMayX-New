import { fetchWithBackoff, getCached, setCached } from './httpClient.ts';
import type { NormalizedAnime } from '../types.ts';

const ANILIST_ENDPOINT = 'https://graphql.anilist.co';
const CACHE_TTL = 5 * 60 * 1000;

interface AniListMediaRaw {
  id: number;
  idMal?: number | null;
  title: {
    romaji?: string | null;
    english?: string | null;
    native?: string | null;
  };
  description?: string | null;
  coverImage?: {
    extraLarge?: string | null;
    large?: string | null;
  } | null;
  bannerImage?: string | null;
  genres?: string[] | null;
  season?: string | null;
  seasonYear?: number | null;
  format?: string | null;
  episodes?: number | null;
  chapters?: number | null;
  volumes?: number | null;
  averageScore?: number | null;
  popularity?: number | null;
  trending?: number | null;
  countryOfOrigin?: string | null;
  trailer?: {
    id?: string | null;
    site?: string | null;
  } | null;
  studios?: {
    nodes?: Array<{ name: string }>;
  } | null;
  status?: string | null;
}

const ANIME_MEDIA_FIELDS = `
  id
  idMal
  title {
    romaji
    english
    native
  }
  description(asHtml: false)
  coverImage {
    extraLarge
    large
  }
  bannerImage
  genres
  season
  seasonYear
  format
  episodes
  chapters
  volumes
  averageScore
  popularity
  trending
  countryOfOrigin
  trailer {
    id
    site
  }
  studios(isMain: true) {
    nodes {
      name
    }
  }
  status
`;

function stripHtml(text?: string | null): string {
  if (!text) return '';
  return text.replace(/<[^>]*>/g, '').replace(/\n{3,}/g, '\n\n').trim();
}

function inferLanguages(origin?: string | null, englishTitle?: string | null): string[] {
  const langs: string[] = [];
  if (origin === 'JP') langs.push('Japanese');
  else if (origin === 'KR') langs.push('Korean');
  else if (origin === 'CN') langs.push('Chinese');
  else langs.push('Original');

  if (englishTitle) {
    langs.push('English Sub');
  }
  return langs;
}

export function normalizeAniListAnime(item: AniListMediaRaw): NormalizedAnime {
  const trailerUrl =
    item.trailer?.site === 'youtube' && item.trailer?.id
      ? `https://www.youtube.com/watch?v=${item.trailer.id}`
      : undefined;

  return {
    id: `anilist_${item.id}`,
    anilistId: item.id,
    malId: item.idMal ?? undefined,
    titleEnglish: item.title?.english || undefined,
    titleRomaji: item.title?.romaji || item.title?.english || `Title #${item.id}`,
    titleNative: item.title?.native || undefined,
    synopsis: stripHtml(item.description),
    posterUrl: item.coverImage?.extraLarge || item.coverImage?.large || '',
    bannerUrl: item.bannerImage || '',
    genres: item.genres || [],
    season: item.season || undefined,
    seasonYear: item.seasonYear || undefined,
    format: item.format || 'TV',
    episodeCount: item.episodes ?? undefined,
    averageScore: item.averageScore ?? undefined,
    popularity: item.popularity ?? undefined,
    trendingRank: item.trending ?? undefined,
    languages: inferLanguages(item.countryOfOrigin, item.title?.english),
    status: 'published',
    featured: Boolean(item.bannerImage && (item.trending ?? 0) > 0),
    hasAuthorizedPlayback: false,
    sourceProvider: 'anilist',
    trailerUrl,
    studios: item.studios?.nodes?.map((s) => s.name) || [],
  };
}

async function queryAniList<T>(query: string, variables: Record<string, unknown>, cacheKey: string): Promise<T> {
  const cached = getCached<T>(cacheKey);
  if (cached) return cached;

  const res = await fetchWithBackoff(ANILIST_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    const bodyText = await res.text().catch(() => '');
    throw new Error(`AniList API HTTP ${res.status}: ${bodyText.slice(0, 200)}`);
  }

  const json = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };
  if (json.errors?.length) {
    throw new Error(`AniList GraphQL error: ${json.errors[0].message}`);
  }
  if (!json.data) {
    throw new Error('AniList returned empty data');
  }

  setCached(cacheKey, json.data, CACHE_TTL);
  return json.data;
}

export interface AniListDiscoverOptions {
  search?: string;
  genre?: string;
  season?: string;
  seasonYear?: number;
  format?: string;
  formatIn?: string[];
  sort?: string;
  countryOfOrigin?: string;
  page?: number;
  perPage?: number;
  type?: 'ANIME' | 'MANGA';
}

export async function discoverAniListMedia(opts: AniListDiscoverOptions) {
  const page = opts.page || 1;
  const perPage = Math.min(opts.perPage || 20, 50);
  const type = opts.type || 'ANIME';
  const sortMap: Record<string, string> = {
    trending: 'TRENDING_DESC',
    popular: 'POPULARITY_DESC',
    score: 'SCORE_DESC',
    recent: 'START_DATE_DESC',
    updated: 'UPDATED_AT_DESC',
  };
  const sortEnum = sortMap[opts.sort || 'trending'] || opts.sort || 'TRENDING_DESC';

  const query = `
    query ($page: Int, $perPage: Int, $type: MediaType, $sort: [MediaSort], $search: String, $genre: String, $season: MediaSeason, $seasonYear: Int, $format: MediaFormat, $formatIn: [MediaFormat], $country: CountryCode) {
      Page(page: $page, perPage: $perPage) {
        pageInfo {
          total
          currentPage
          lastPage
          hasNextPage
        }
        media(
          type: $type,
          sort: $sort,
          search: $search,
          genre: $genre,
          season: $season,
          seasonYear: $seasonYear,
          format: $format,
          format_in: $formatIn,
          countryOfOrigin: $country,
          isAdult: false
        ) {
          ${ANIME_MEDIA_FIELDS}
        }
      }
    }
  `;

  const variables: Record<string, unknown> = {
    page,
    perPage,
    type,
    sort: [sortEnum],
  };
  if (opts.search?.trim()) variables.search = opts.search.trim();
  if (opts.genre?.trim()) variables.genre = opts.genre.trim();
  if (opts.season?.trim() && type === 'ANIME') variables.season = opts.season.trim().toUpperCase();
  if (opts.seasonYear && type === 'ANIME') variables.seasonYear = opts.seasonYear;
  if (opts.format?.trim()) variables.format = opts.format.trim().toUpperCase();
  if (opts.formatIn?.length) variables.formatIn = opts.formatIn;
  if (opts.countryOfOrigin?.trim()) variables.country = opts.countryOfOrigin.trim().toUpperCase();

  const cacheKey = `anilist:discover:${JSON.stringify(variables)}`;
  const data = await queryAniList<{
    Page: {
      pageInfo: { total: number; currentPage: number; lastPage: number; hasNextPage: boolean };
      media: AniListMediaRaw[];
    };
  }>(query, variables, cacheKey);

  return {
    pageInfo: data.Page.pageInfo,
    items: data.Page.media.map((m) => ({
      ...normalizeAniListAnime(m),
      chapters: m.chapters ?? undefined,
      volumes: m.volumes ?? undefined,
      airingStatus: m.status || undefined,
    })),
  };
}

export async function fetchAniListMediaById(id: number, type: 'ANIME' | 'MANGA' = 'ANIME') {
  const query = `
    query ($id: Int, $type: MediaType) {
      Media(id: $id, type: $type, isAdult: false) {
        ${ANIME_MEDIA_FIELDS}
        nextAiringEpisode {
          episode
          airingAt
        }
        relations {
          edges {
            relationType
            node {
              id
              title {
                romaji
                english
              }
              format
              type
              coverImage {
                large
              }
            }
          }
        }
      }
    }
  `;

  const data = await queryAniList<{
    Media: AniListMediaRaw & {
      nextAiringEpisode?: { episode: number; airingAt: number } | null;
      relations?: {
        edges: Array<{
          relationType: string;
          node: {
            id: number;
            title: { romaji?: string; english?: string };
            format?: string;
            type?: string;
            coverImage?: { large?: string };
          };
        }>;
      };
    };
  }>(query, { id, type }, `anilist:media:${type}:${id}`);

  return {
    ...normalizeAniListAnime(data.Media),
    chapters: data.Media.chapters ?? undefined,
    volumes: data.Media.volumes ?? undefined,
    airingStatus: data.Media.status || undefined,
    nextAiringEpisode: data.Media.nextAiringEpisode || null,
    relations:
      data.Media.relations?.edges?.slice(0, 8).map((edge) => ({
        relationType: edge.relationType,
        id: `anilist_${edge.node.id}`,
        anilistId: edge.node.id,
        title: edge.node.title?.english || edge.node.title?.romaji || '',
        format: edge.node.format || '',
        type: edge.node.type || '',
        posterUrl: edge.node.coverImage?.large || '',
      })) || [],
  };
}
