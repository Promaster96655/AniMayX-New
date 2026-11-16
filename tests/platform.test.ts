import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { isSafePublicHttpsUrl } from '../server/providers/httpClient.ts';
import { normalizeAniListAnime } from '../server/providers/anilist.ts';
import { isTmdbConfigured } from '../server/providers/tmdb.ts';
import { isComicVineConfigured } from '../server/providers/mangadex.ts';
import { verifyFirebaseToken } from '../server/firebaseAdmin.ts';
import {
  getConsumetBaseUrl,
  isConsumetConfigured,
  setRuntimeConsumetUrl,
} from '../server/providers/consumet.ts';

describe('AniMayX Security & Provider Tests', () => {
  it('blocks private/SSRF URLs in playback validation', () => {
    expect(isSafePublicHttpsUrl('https://cdn.example.com/video/master.m3u8')).toBe(true);
    expect(isSafePublicHttpsUrl('http://localhost:3000/secret')).toBe(false);
    expect(isSafePublicHttpsUrl('http://127.0.0.1/admin')).toBe(false);
    expect(isSafePublicHttpsUrl('https://169.254.169.254/latest/meta-data')).toBe(false);
    expect(isSafePublicHttpsUrl('https://192.168.1.10/internal')).toBe(false);
    expect(isSafePublicHttpsUrl('javascript:alert(1)')).toBe(false);
  });

  it('normalizes AniList media without inventing playback availability', () => {
    const normalized = normalizeAniListAnime({
      id: 21,
      idMal: 21,
      title: { romaji: 'ONE PIECE', english: 'One Piece', native: 'ワンピース' },
      description: '<p>Test synopsis</p>',
      coverImage: { extraLarge: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/nx21.jpg' },
      genres: ['Action', 'Adventure'],
      format: 'TV',
      countryOfOrigin: 'JP',
    });

    expect(normalized.id).toBe('anilist_21');
    expect(normalized.malId).toBe(21);
    expect(normalized.hasAuthorizedPlayback).toBe(false);
    expect(normalized.bannerUrl).toBe('');
    expect(normalized.synopsis).toBe('Test synopsis');
    expect(normalized.languages).toContain('Japanese');
  });

  it('rejects empty or forged Firebase ID tokens', async () => {
    await expect(verifyFirebaseToken('')).rejects.toThrow();
    await expect(verifyFirebaseToken('not-a-valid-jwt-token')).rejects.toThrow();
  });

  it('reports accurate TMDB and ComicVine configuration status', () => {
    expect(typeof isTmdbConfigured()).toBe('boolean');
    expect(typeof isComicVineConfigured()).toBe('boolean');
  });

  it('validates and updates Consumet API runtime base URL safely', () => {
    const previous = getConsumetBaseUrl();
    try {
      expect(() => setRuntimeConsumetUrl('http://127.0.0.1:4000')).toThrow();
      setRuntimeConsumetUrl('https://consumet.example.com/');
      expect(getConsumetBaseUrl()).toBe('https://consumet.example.com');
      expect(isConsumetConfigured()).toBe(true);
      setRuntimeConsumetUrl('');
      expect(isConsumetConfigured()).toBe(false);
    } finally {
      if (previous) {
        setRuntimeConsumetUrl(previous);
      } else {
        setRuntimeConsumetUrl('');
      }
    }
  });

  it('enforces restrictive security invariants in firestore.rules', () => {
    const rules = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf-8');
    expect(rules).toContain("rules_version = '2';");
    expect(rules).toContain('allow read, write: if false;');
    expect(rules).toContain("match /admins/{uid}");
    expect(rules).toContain("request.auth.token.email_verified == true && request.auth.token.email == 'mrzorvixofficial@gmail.com'");
    expect(rules).toContain('isValidDiscordUrl');
    expect(rules).toContain('affectedKeys().hasOnly');
  });
});
