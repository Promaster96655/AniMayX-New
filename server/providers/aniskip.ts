import { fetchWithBackoff, getCached, setCached } from './httpClient.ts';
import type { AniSkipResult } from '../types.ts';

const ANISKIP_BASE = 'https://api.aniskip.com/v2/skip-times';
const CACHE_TTL = 15 * 60 * 1000;

export async function fetchAniSkipTimings(
  malId: number,
  episodeNumber: number,
  episodeLength = 0
): Promise<AniSkipResult> {
  if (!Number.isInteger(malId) || malId <= 0 || !Number.isInteger(episodeNumber) || episodeNumber <= 0) {
    return { available: false };
  }

  const cacheKey = `aniskip:${malId}:${episodeNumber}`;
  const cached = getCached<AniSkipResult>(cacheKey);
  if (cached) return cached;

  const url = `${ANISKIP_BASE}/${malId}/${episodeNumber}?types=op&types=ed&episodeLength=${Math.max(0, Math.round(episodeLength))}`;

  try {
    const res = await fetchWithBackoff(url, { headers: { Accept: 'application/json' } }, 2, 400);
    if (!res.ok) {
      const empty: AniSkipResult = { available: false };
      setCached(cacheKey, empty, 5 * 60 * 1000);
      return empty;
    }

    const data = (await res.json()) as {
      found?: boolean;
      results?: Array<{
        skipType: string;
        interval?: { startTime?: number; endTime?: number };
        episodeLength?: number;
      }>;
    };

    if (!data.found || !Array.isArray(data.results) || data.results.length === 0) {
      const empty: AniSkipResult = { available: false };
      setCached(cacheKey, empty, 5 * 60 * 1000);
      return empty;
    }

    let op: { startTime: number; endTime: number } | undefined;
    let ed: { startTime: number; endTime: number } | undefined;
    let detectedLength: number | undefined;

    for (const entry of data.results) {
      const start = entry.interval?.startTime;
      const end = entry.interval?.endTime;
      if (typeof start === 'number' && typeof end === 'number' && start >= 0 && end > start) {
        if (entry.skipType === 'op' && !op) {
          op = { startTime: start, endTime: end };
        }
        if (entry.skipType === 'ed' && !ed) {
          ed = { startTime: start, endTime: end };
        }
        if (typeof entry.episodeLength === 'number' && entry.episodeLength > 0) {
          detectedLength = entry.episodeLength;
        }
      }
    }

    const result: AniSkipResult = {
      available: Boolean(op || ed),
      op,
      ed,
      episodeLength: detectedLength,
    };

    setCached(cacheKey, result, CACHE_TTL);
    return result;
  } catch {
    return { available: false };
  }
}
