import { Router, type Request, type Response, type NextFunction } from 'express';
import { FieldValue } from 'firebase-admin/firestore';
import {
  INITIAL_ADMIN_EMAIL,
  initFirebaseAdmin,
  verifyFirebaseToken,
  type VerifiedUserContext,
} from './firebaseAdmin.ts';
import { discoverAniListMedia, fetchAniListMediaById } from './providers/anilist.ts';
import { fetchJikanAnimeEpisodes } from './providers/jikan.ts';
import { fetchAniSkipTimings } from './providers/aniskip.ts';
import {
  discoverTmdb,
  fetchTmdbDetails,
  fetchTmdbGenres,
  isTmdbConfigured,
} from './providers/tmdb.ts';
import {
  discoverComicVine,
  discoverMangaDex,
  fetchMangaDexById,
  fetchMangaDexChapterPages,
  fetchMangaDexChapters,
  isComicVineConfigured,
} from './providers/mangadex.ts';
import { fetchWithBackoff, isSafePublicHttpsUrl } from './providers/httpClient.ts';
import { getSyncStatusSnapshot, getSyncedAnimeSnapshot, runCatalogueSync } from './syncService.ts';
import {
  consumetAnimeInfo,
  consumetAnimeSearch,
  consumetAnimeWatch,
  consumetBooksSearch,
  consumetComicsSearch,
  consumetMangaInfo,
  consumetMangaRead,
  consumetMangaSearch,
  consumetMetaInfo,
  consumetMetaSearch,
  consumetMetaTrending,
  consumetMetaWatch,
  consumetMoviesInfo,
  consumetMoviesSearch,
  consumetMoviesWatch,
  consumetNovelsInfo,
  consumetNovelsRead,
  consumetNovelsSearch,
  getConsumetBaseUrl,
  isConsumetConfigured,
  setRuntimeConsumetUrl,
} from './providers/consumet.ts';

interface AuthedRequest extends Request {
  user?: VerifiedUserContext;
}

let bootstrapDisabled = false;
let lastManualSyncAt = 0;

async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    req.user = await verifyFirebaseToken(token);
    next();
  } catch (err) {
    res.status(401).json({ error: err instanceof Error ? err.message : 'Invalid token' });
  }
}

function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user?.isAdmin) {
    res.status(403).json({ error: 'Forbidden: Administrator privileges required' });
    return;
  }
  next();
}

export function createApiRouter() {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'AniMayX API', timestamp: new Date().toISOString() });
  });

  router.get('/providers/status', (_req, res) => {
    const { hasServiceAccount } = initFirebaseAdmin();
    res.json({
      providers: {
        anime: { anilist: true, jikan: true, aniskip: true },
        moviesAndTv: { tmdb: isTmdbConfigured() },
        manga: { mangadex: true, anilist: true },
        lightNovels: { anilist: true },
        comics: { comicvine: isComicVineConfigured(), consumet: isConsumetConfigured() },
        consumet: { configured: isConsumetConfigured() },
        firebaseAdminSdk: hasServiceAccount,
        discordWidget: Boolean(process.env.DISCORD_GUILD_ID?.trim()),
      },
    });
  });

  // --------------------------------------------------------------------------
  // Anime (AniList + Jikan + AniSkip)
  // --------------------------------------------------------------------------
  router.get('/anime/discover', async (req, res) => {
    try {
      const q = typeof req.query.q === 'string' ? req.query.q : undefined;
      const genre = typeof req.query.genre === 'string' ? req.query.genre : undefined;
      const season = typeof req.query.season === 'string' ? req.query.season : undefined;
      const seasonYear = req.query.year ? Number(req.query.year) : undefined;
      const format = typeof req.query.format === 'string' ? req.query.format : undefined;
      const sort = typeof req.query.sort === 'string' ? req.query.sort : 'trending';
      const language = typeof req.query.language === 'string' ? req.query.language : undefined;
      const page = req.query.page ? Number(req.query.page) : 1;
      const perPage = req.query.perPage ? Number(req.query.perPage) : 20;

      const countryMap: Record<string, string> = {
        japanese: 'JP',
        korean: 'KR',
        chinese: 'CN',
      };
      const countryOfOrigin = language ? countryMap[language.toLowerCase()] : undefined;

      const formatIn =
        format && format !== 'ALL'
          ? [format.toUpperCase()]
          : req.query.category === 'movies'
          ? ['MOVIE']
          : undefined;

      const data = await discoverAniListMedia({
        type: 'ANIME',
        search: q,
        genre: genre && genre !== 'All' ? genre : undefined,
        season: season && season !== 'ALL' ? season : undefined,
        seasonYear: seasonYear && Number.isFinite(seasonYear) ? seasonYear : undefined,
        formatIn,
        sort,
        countryOfOrigin,
        page,
        perPage,
      });

      res.json(data);
    } catch (err) {
      const snapshot = getSyncedAnimeSnapshot();
      res.status(200).json({
        pageInfo: { total: snapshot.series.length, currentPage: 1, lastPage: 1, hasNextPage: false },
        items: snapshot.series.slice(0, 20),
        warning: err instanceof Error ? err.message : 'AniList temporarily unavailable',
      });
    }
  });

  router.get('/anime/:id', async (req, res) => {
    try {
      const rawId = req.params.id;
      const numericId = Number(rawId.replace(/^anilist_/, ''));
      if (!Number.isInteger(numericId) || numericId <= 0) {
        res.status(400).json({ error: 'Invalid AniList anime identifier' });
        return;
      }

      const anime = await fetchAniListMediaById(numericId, 'ANIME');
      let jikanEpisodes: Awaited<ReturnType<typeof fetchJikanAnimeEpisodes>> = {
        episodes: [],
        hasNextPage: false,
      };
      if (anime.malId) {
        jikanEpisodes = await fetchJikanAnimeEpisodes(anime.malId, 1).catch(() => ({
          episodes: [],
          hasNextPage: false,
        }));
      }

      res.json({
        anime,
        jikanEpisodes: jikanEpisodes.episodes,
      });
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : 'Failed to fetch anime details' });
    }
  });

  router.get('/aniskip/:malId/:episode', async (req, res) => {
    const malId = Number(req.params.malId);
    const episode = Number(req.params.episode);
    const length = req.query.length ? Number(req.query.length) : 0;
    const result = await fetchAniSkipTimings(malId, episode, length);
    res.json(result);
  });

  // --------------------------------------------------------------------------
  // Movies & Web Series (Official TMDB)
  // --------------------------------------------------------------------------
  router.get('/tmdb/discover', async (req, res) => {
    try {
      const mediaType = req.query.mediaType === 'tv' ? 'tv' : 'movie';
      const query = typeof req.query.q === 'string' ? req.query.q : undefined;
      const genre = typeof req.query.genre === 'string' ? req.query.genre : undefined;
      const language = typeof req.query.language === 'string' ? req.query.language : undefined;
      const region = typeof req.query.region === 'string' ? req.query.region : undefined;
      const sortBy = typeof req.query.sort === 'string' ? req.query.sort : 'trending';
      const page = req.query.page ? Number(req.query.page) : 1;

      const data = await discoverTmdb({ mediaType, query, genre, language, region, sortBy, page });
      res.json(data);
    } catch (err) {
      res.status(502).json({
        configured: isTmdbConfigured(),
        items: [],
        message: err instanceof Error ? err.message : 'TMDB request failed',
      });
    }
  });

  router.get('/tmdb/genres/:type', async (req, res) => {
    try {
      const mediaType = req.params.type === 'tv' ? 'tv' : 'movie';
      const data = await fetchTmdbGenres(mediaType);
      res.json(data);
    } catch (err) {
      res.status(502).json({ configured: isTmdbConfigured(), genres: [], error: String(err) });
    }
  });

  router.get('/tmdb/:type/:id', async (req, res) => {
    try {
      const mediaType = req.params.type === 'tv' ? 'tv' : 'movie';
      const id = Number(req.params.id.replace(/^tmdb_(movie|tv)_/, ''));
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: 'Invalid TMDB ID' });
        return;
      }
      const data = await fetchTmdbDetails(mediaType, id);
      res.json(data);
    } catch (err) {
      res.status(502).json({ configured: isTmdbConfigured(), error: err instanceof Error ? err.message : 'TMDB error' });
    }
  });

  // --------------------------------------------------------------------------
  // Manga (MangaDex v5)
  // --------------------------------------------------------------------------
  router.get('/manga/discover', async (req, res) => {
    try {
      const query = typeof req.query.q === 'string' ? req.query.q : undefined;
      const language = typeof req.query.language === 'string' ? req.query.language : undefined;
      const page = req.query.page ? Number(req.query.page) : 1;
      const data = await discoverMangaDex({ query, language, page, limit: 20 });
      res.json({ configured: true, ...data });
    } catch (err) {
      res.status(502).json({ configured: true, items: [], total: 0, error: err instanceof Error ? err.message : 'MangaDex error' });
    }
  });

  router.get('/manga/:id', async (req, res) => {
    try {
      const item = await fetchMangaDexById(req.params.id);
      const lang = typeof req.query.language === 'string' ? req.query.language : 'en';
      const chapters = await fetchMangaDexChapters(req.params.id, lang);
      res.json({ item, chapters });
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : 'Failed to fetch manga details' });
    }
  });

  router.get('/manga/chapter/:chapterId/pages', async (req, res) => {
    try {
      const data = await fetchMangaDexChapterPages(req.params.chapterId);
      res.json(data);
    } catch (err) {
      res.status(502).json({ available: false, pages: [], error: err instanceof Error ? err.message : 'Chapter unavailable' });
    }
  });

  // --------------------------------------------------------------------------
  // Light Novels (AniList MANGA format: NOVEL)
  // --------------------------------------------------------------------------
  router.get('/novels/discover', async (req, res) => {
    try {
      const q = typeof req.query.q === 'string' ? req.query.q : undefined;
      const genre = typeof req.query.genre === 'string' ? req.query.genre : undefined;
      const sort = typeof req.query.sort === 'string' ? req.query.sort : 'popular';
      const page = req.query.page ? Number(req.query.page) : 1;

      const data = await discoverAniListMedia({
        type: 'MANGA',
        format: 'NOVEL',
        search: q,
        genre: genre && genre !== 'All' ? genre : undefined,
        sort,
        page,
        perPage: 20,
      });
      res.json({ configured: true, ...data });
    } catch (err) {
      res.status(502).json({ configured: true, items: [], error: err instanceof Error ? err.message : 'AniList novel error' });
    }
  });

  router.get('/novels/:id', async (req, res) => {
    try {
      const numericId = Number(req.params.id.replace(/^anilist_/, ''));
      if (!Number.isInteger(numericId) || numericId <= 0) {
        res.status(400).json({ error: 'Invalid Light Novel ID' });
        return;
      }
      const novel = await fetchAniListMediaById(numericId, 'MANGA');
      res.json({ novel });
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : 'Failed to fetch novel' });
    }
  });

  // --------------------------------------------------------------------------
  // Comics (ComicVine when configured)
  // --------------------------------------------------------------------------
  router.get('/comics/discover', async (req, res) => {
    try {
      const q = typeof req.query.q === 'string' ? req.query.q : '';
      const page = req.query.page ? Number(req.query.page) : 1;
      const data = await discoverComicVine(q, page);
      res.json(data);
    } catch (err) {
      res.status(502).json({
        configured: isComicVineConfigured(),
        items: [],
        message: err instanceof Error ? err.message : 'Comics provider error',
      });
    }
  });

  // --------------------------------------------------------------------------
  // Consumet API Integration (/books, /anime, /manga, /comics, /light-novels, /movies, /meta)
  // --------------------------------------------------------------------------
  router.get('/consumet/meta/anilist/trending', async (req, res) => {
    if (!isConsumetConfigured()) {
      res.json({ configured: false, results: [] });
      return;
    }
    try {
      const data = await consumetMetaTrending(Number(req.query.page || 1));
      res.json({ configured: true, ...data });
    } catch (err) {
      res.status(502).json({ configured: true, error: err instanceof Error ? err.message : 'Consumet error' });
    }
  });

  router.get('/consumet/meta/anilist/search', async (req, res) => {
    if (!isConsumetConfigured()) {
      res.json({ configured: false, results: [] });
      return;
    }
    try {
      const q = String(req.query.q || '').trim();
      const data = q ? await consumetMetaSearch(q, Number(req.query.page || 1)) : { results: [] };
      res.json({ configured: true, ...data });
    } catch (err) {
      res.status(502).json({ configured: true, error: err instanceof Error ? err.message : 'Consumet error' });
    }
  });

  router.get('/consumet/meta/anilist/info/:id', async (req, res) => {
    if (!isConsumetConfigured()) {
      res.json({ configured: false, info: null });
      return;
    }
    try {
      const provider = typeof req.query.provider === 'string' ? req.query.provider : 'gogoanime';
      const info = await consumetMetaInfo(req.params.id, provider);
      res.json({ configured: true, info });
    } catch (err) {
      res.status(502).json({ configured: true, error: err instanceof Error ? err.message : 'Consumet error' });
    }
  });

  router.get('/consumet/meta/anilist/watch/:episodeId', async (req, res) => {
    if (!isConsumetConfigured()) {
      res.json({ configured: false, sources: [] });
      return;
    }
    try {
      const provider = typeof req.query.provider === 'string' ? req.query.provider : 'gogoanime';
      const watch = await consumetMetaWatch(req.params.episodeId, provider);
      res.json({ configured: true, ...watch });
    } catch (err) {
      res.status(502).json({ configured: true, error: err instanceof Error ? err.message : 'Consumet error' });
    }
  });

  router.get('/consumet/anime/:provider/search', async (req, res) => {
    if (!isConsumetConfigured()) {
      res.json({ configured: false, results: [] });
      return;
    }
    try {
      const data = await consumetAnimeSearch(req.params.provider, String(req.query.q || ''), Number(req.query.page || 1));
      res.json({ configured: true, ...data });
    } catch (err) {
      res.status(502).json({ configured: true, error: err instanceof Error ? err.message : 'Consumet error' });
    }
  });

  router.get('/consumet/anime/:provider/info', async (req, res) => {
    if (!isConsumetConfigured()) {
      res.json({ configured: false, info: null });
      return;
    }
    try {
      const info = await consumetAnimeInfo(req.params.provider, String(req.query.id || ''));
      res.json({ configured: true, info });
    } catch (err) {
      res.status(502).json({ configured: true, error: err instanceof Error ? err.message : 'Consumet error' });
    }
  });

  router.get('/consumet/anime/:provider/watch/:episodeId', async (req, res) => {
    if (!isConsumetConfigured()) {
      res.json({ configured: false, sources: [] });
      return;
    }
    try {
      const watch = await consumetAnimeWatch(req.params.provider, req.params.episodeId);
      res.json({ configured: true, ...watch });
    } catch (err) {
      res.status(502).json({ configured: true, error: err instanceof Error ? err.message : 'Consumet error' });
    }
  });

  router.get('/consumet/manga/:provider/search', async (req, res) => {
    if (!isConsumetConfigured()) {
      res.json({ configured: false, results: [] });
      return;
    }
    try {
      const data = await consumetMangaSearch(req.params.provider, String(req.query.q || ''));
      res.json({ configured: true, ...data });
    } catch (err) {
      res.status(502).json({ configured: true, error: err instanceof Error ? err.message : 'Consumet error' });
    }
  });

  router.get('/consumet/manga/:provider/info', async (req, res) => {
    if (!isConsumetConfigured()) {
      res.json({ configured: false, info: null });
      return;
    }
    try {
      const info = await consumetMangaInfo(req.params.provider, String(req.query.id || ''));
      res.json({ configured: true, info });
    } catch (err) {
      res.status(502).json({ configured: true, error: err instanceof Error ? err.message : 'Consumet error' });
    }
  });

  router.get('/consumet/manga/:provider/read', async (req, res) => {
    if (!isConsumetConfigured()) {
      res.json({ configured: false, pages: [] });
      return;
    }
    try {
      const pages = await consumetMangaRead(req.params.provider, String(req.query.chapterId || ''));
      res.json({ configured: true, pages });
    } catch (err) {
      res.status(502).json({ configured: true, error: err instanceof Error ? err.message : 'Consumet error' });
    }
  });

  router.get('/consumet/movies/:provider/search', async (req, res) => {
    if (!isConsumetConfigured()) {
      res.json({ configured: false, results: [] });
      return;
    }
    try {
      const data = await consumetMoviesSearch(req.params.provider, String(req.query.q || ''), Number(req.query.page || 1));
      res.json({ configured: true, ...data });
    } catch (err) {
      res.status(502).json({ configured: true, error: err instanceof Error ? err.message : 'Consumet error' });
    }
  });

  router.get('/consumet/movies/:provider/info', async (req, res) => {
    if (!isConsumetConfigured()) {
      res.json({ configured: false, info: null });
      return;
    }
    try {
      const info = await consumetMoviesInfo(req.params.provider, String(req.query.id || ''));
      res.json({ configured: true, info });
    } catch (err) {
      res.status(502).json({ configured: true, error: err instanceof Error ? err.message : 'Consumet error' });
    }
  });

  router.get('/consumet/movies/:provider/watch', async (req, res) => {
    if (!isConsumetConfigured()) {
      res.json({ configured: false, sources: [] });
      return;
    }
    try {
      const watch = await consumetMoviesWatch(
        req.params.provider,
        String(req.query.episodeId || ''),
        String(req.query.mediaId || '')
      );
      res.json({ configured: true, ...watch });
    } catch (err) {
      res.status(502).json({ configured: true, error: err instanceof Error ? err.message : 'Consumet error' });
    }
  });

  router.get('/consumet/light-novels/:provider/search', async (req, res) => {
    if (!isConsumetConfigured()) {
      res.json({ configured: false, results: [] });
      return;
    }
    try {
      const data = await consumetNovelsSearch(req.params.provider, String(req.query.q || ''));
      res.json({ configured: true, ...data });
    } catch (err) {
      res.status(502).json({ configured: true, error: err instanceof Error ? err.message : 'Consumet error' });
    }
  });

  router.get('/consumet/light-novels/:provider/info', async (req, res) => {
    if (!isConsumetConfigured()) {
      res.json({ configured: false, info: null });
      return;
    }
    try {
      const info = await consumetNovelsInfo(req.params.provider, String(req.query.id || ''));
      res.json({ configured: true, info });
    } catch (err) {
      res.status(502).json({ configured: true, error: err instanceof Error ? err.message : 'Consumet error' });
    }
  });

  router.get('/consumet/light-novels/:provider/read', async (req, res) => {
    if (!isConsumetConfigured()) {
      res.json({ configured: false, content: null });
      return;
    }
    try {
      const content = await consumetNovelsRead(req.params.provider, String(req.query.chapterId || ''));
      res.json({ configured: true, content });
    } catch (err) {
      res.status(502).json({ configured: true, error: err instanceof Error ? err.message : 'Consumet error' });
    }
  });

  router.get('/consumet/comics/search', async (req, res) => {
    if (!isConsumetConfigured()) {
      res.json({ configured: false, results: [] });
      return;
    }
    try {
      const data = await consumetComicsSearch(String(req.query.q || ''));
      res.json({ configured: true, ...data });
    } catch (err) {
      res.status(502).json({ configured: true, error: err instanceof Error ? err.message : 'Consumet error' });
    }
  });

  router.get('/consumet/books/search', async (req, res) => {
    if (!isConsumetConfigured()) {
      res.json({ configured: false, results: [] });
      return;
    }
    try {
      const data = await consumetBooksSearch(String(req.query.q || ''));
      res.json({ configured: true, ...data });
    } catch (err) {
      res.status(502).json({ configured: true, error: err instanceof Error ? err.message : 'Consumet error' });
    }
  });

  router.get('/admin/consumet-config', requireAuth, requireAdmin, (_req, res) => {
    res.json({
      configured: isConsumetConfigured(),
      baseUrl: getConsumetBaseUrl(),
    });
  });

  router.post('/admin/consumet-config', requireAuth, requireAdmin, (req, res) => {
    const { baseUrl } = (req.body || {}) as { baseUrl?: string };
    try {
      setRuntimeConsumetUrl(baseUrl || '');
      res.json({
        configured: isConsumetConfigured(),
        baseUrl: getConsumetBaseUrl(),
      });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid Consumet URL' });
    }
  });

  // --------------------------------------------------------------------------
  // Discord Widget Info (Public, no bot tokens)
  // --------------------------------------------------------------------------
  router.get('/community/discord-widget', async (_req, res) => {
    const guildId = process.env.DISCORD_GUILD_ID?.trim();
    if (!guildId) {
      res.json({ widgetAvailable: false });
      return;
    }
    try {
      const r = await fetchWithBackoff(`https://discord.com/api/guilds/${encodeURIComponent(guildId)}/widget.json`, {}, 1, 300);
      if (!r.ok) {
        res.json({ widgetAvailable: false });
        return;
      }
      const widget = (await r.json()) as { name?: string; presence_count?: number; instant_invite?: string };
      res.json({
        widgetAvailable: true,
        guildName: widget.name || null,
        presenceCount: typeof widget.presence_count === 'number' ? widget.presence_count : null,
      });
    } catch {
      res.json({ widgetAvailable: false });
    }
  });

  // --------------------------------------------------------------------------
  // Playback configuration validation layer
  // --------------------------------------------------------------------------
  router.post('/playback/resolve', (req, res) => {
    const { url, type } = (req.body || {}) as { url?: string; type?: string };
    if (!url || typeof url !== 'string' || !isSafePublicHttpsUrl(url)) {
      res.status(400).json({ valid: false, error: 'Playback source URL is missing or failed security validation.' });
      return;
    }
    if (!url.startsWith('https://')) {
      res.status(400).json({ valid: false, error: 'Only HTTPS authorized playback URLs are permitted.' });
      return;
    }
    const resolvedType = type === 'hls' || url.includes('.m3u8') ? 'hls' : type === 'dash' || url.includes('.mpd') ? 'dash' : 'mp4';
    res.json({ valid: true, url, type: resolvedType });
  });

  // --------------------------------------------------------------------------
  // Authenticated User & Admin Endpoints
  // --------------------------------------------------------------------------
  router.get('/admin/me', requireAuth, (req: AuthedRequest, res) => {
    res.json({
      uid: req.user!.uid,
      email: req.user!.email,
      emailVerified: req.user!.emailVerified,
      isAdmin: req.user!.isAdmin,
      initialAdminEmail: INITIAL_ADMIN_EMAIL,
      bootstrapCompleted: bootstrapDisabled,
    });
  });

  router.post('/admin/bootstrap', requireAuth, async (req: AuthedRequest, res) => {
    const user = req.user!;
    if (!user.emailVerified || user.email !== INITIAL_ADMIN_EMAIL) {
      res.status(403).json({
        error: 'Forbidden: Only the verified designated initial administrator email can run bootstrap.',
      });
      return;
    }

    const { adminAuth, adminDb, hasServiceAccount } = initFirebaseAdmin();

    if (bootstrapDisabled) {
      res.status(409).json({ error: 'Initial administrator bootstrap has already been completed and disabled.' });
      return;
    }

    if (adminDb) {
      const lockSnap = await adminDb.collection('system').doc('adminBootstrap').get();
      if (lockSnap.exists && lockSnap.data()?.completed === true) {
        bootstrapDisabled = true;
        res.status(409).json({ error: 'Initial administrator bootstrap has already been completed and disabled.' });
        return;
      }

      if (adminAuth) {
        await adminAuth.setCustomUserClaims(user.uid, { admin: true, role: 'super_admin' });
      }
      await adminDb.collection('admins').doc(user.uid).set({
        uid: user.uid,
        email: user.email,
        role: 'super_admin',
        grantedAt: FieldValue.serverTimestamp(),
      });
      await adminDb.collection('system').doc('adminBootstrap').set({
        completed: true,
        adminUid: user.uid,
        completedAt: FieldValue.serverTimestamp(),
      });
      await adminDb.collection('adminAuditLogs').doc(`bootstrap_${Date.now()}`).set({
        id: `bootstrap_${Date.now()}`,
        actorUid: user.uid,
        action: 'INITIAL_ADMIN_BOOTSTRAP',
        targetPath: `admins/${user.uid}`,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    bootstrapDisabled = true;
    res.json({
      bootstrapped: true,
      customClaimsGranted: Boolean(hasServiceAccount && adminAuth),
      message: hasServiceAccount
        ? 'Initial administrator provisioned via Firebase Admin SDK and one-time bootstrap is now disabled.'
        : 'Initial administrator verified via Firebase ID token. Configure FIREBASE_SERVICE_ACCOUNT_JSON to also write custom claims and /admins/{uid} on the server.',
    });
  });

  router.get('/admin/sync/status', requireAuth, requireAdmin, (_req, res) => {
    res.json(getSyncStatusSnapshot());
  });

  router.post('/admin/sync/now', requireAuth, requireAdmin, async (_req, res) => {
    const now = Date.now();
    if (now - lastManualSyncAt < 15_000) {
      res.status(429).json({ error: 'Rate limited: Please wait 15 seconds between manual sync runs.' });
      return;
    }
    lastManualSyncAt = now;
    const result = await runCatalogueSync('manual');
    res.json({ ...result, status: getSyncStatusSnapshot() });
  });

  router.get('/admin/search-provider', requireAuth, requireAdmin, async (req, res) => {
    const provider = req.query.provider === 'tmdb' ? 'tmdb' : 'anilist';
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const mediaType = req.query.type === 'MOVIE' ? 'MOVIE' : 'ANIME';
    if (!q) {
      res.json({ items: [] });
      return;
    }
    try {
      if (provider === 'tmdb') {
        const result = await discoverTmdb({ query: q, mediaType: req.query.type === 'tv' ? 'tv' : 'movie' });
        res.json(result);
        return;
      }
      const result = await discoverAniListMedia({
        type: 'ANIME',
        search: q,
        format: mediaType === 'MOVIE' ? 'MOVIE' : undefined,
        page: 1,
        perPage: 12,
      });
      res.json({ configured: true, items: result.items });
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : 'Provider search failed' });
    }
  });

  router.post('/admin/validate-source', requireAuth, requireAdmin, async (req, res) => {
    const { url, type } = (req.body || {}) as { url?: string; type?: string };
    if (!url || typeof url !== 'string' || !url.startsWith('https://') || !isSafePublicHttpsUrl(url)) {
      res.status(400).json({ valid: false, error: 'Source URL must be a valid, public HTTPS URL.' });
      return;
    }

    try {
      const headRes = await fetchWithBackoff(url, { method: 'HEAD' }, 1, 300);
      const contentType = headRes.headers.get('content-type') || '';
      res.json({
        valid: headRes.ok,
        statusCode: headRes.status,
        contentType,
        detectedType: type || (url.includes('.m3u8') ? 'hls' : 'mp4'),
        message: headRes.ok
          ? `Source verified (HTTP ${headRes.status}${contentType ? `, ${contentType}` : ''}).`
          : `Source returned HTTP ${headRes.status}. Verify CORS and availability before publishing.`,
      });
    } catch (err) {
      res.json({
        valid: false,
        message: `Could not probe URL from server (${err instanceof Error ? err.message : 'network error'}). It may still play in-browser if CORS allows.`,
      });
    }
  });

  return router;
}
