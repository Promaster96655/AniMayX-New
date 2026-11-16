import React, { useCallback, useEffect, useState } from 'react';
import {
  RefreshCw,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Edit,
  Film,
  MessageSquare,
} from 'lucide-react';
import { apiGet, apiPost } from '../lib/apiClient';
import { useAuth } from '../contexts/AuthContext';
import { useCommunity } from '../contexts/CommunityContext';
import { useToast } from '../contexts/ToastContext';
import {
  deleteAdminAnime,
  deleteAdminEpisode,
  listAdminFirestoreAnime,
  listEpisodesForAnime,
  saveAdminAnime,
  saveAdminEpisode,
  saveDiscordCommunitySettings,
} from '../lib/firestoreService';
import type {
  AnimeItem,
  CommunitySettings,
  EpisodeItem,
  PlaybackSource,
  SubtitleTrack,
  SyncJob,
  SyncLog,
} from '../lib/types';

type AdminTab = 'catalogue' | 'episodes' | 'sync' | 'discord';

export function AdminAnimePage() {
  const { user } = useAuth();
  const { discord, refreshCommunity } = useCommunity();
  const { showToast } = useToast();

  const [tab, setTab] = useState<AdminTab>('catalogue');
  const [collectionTarget, setCollectionTarget] = useState<'anime' | 'animeMovies'>('anime');
  const [catalog, setCatalog] = useState<AnimeItem[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);

  // Sync Dashboard State
  const [syncJobs, setSyncJobs] = useState<SyncJob[]>([]);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [nextSyncAt, setNextSyncAt] = useState<string | null>(null);
  const [firestoreAdminSdk, setFirestoreAdminSdk] = useState<boolean>(false);
  const [syncingNow, setSyncingNow] = useState(false);

  // Consumet API Config State
  const [consumetUrlInput, setConsumetUrlInput] = useState('');
  const [consumetConfigured, setConsumetConfigured] = useState(false);
  const [savingConsumet, setSavingConsumet] = useState(false);

  // Provider Import & Anime Editor
  const [importQuery, setImportQuery] = useState('');
  const [importResults, setImportResults] = useState<AnimeItem[]>([]);
  const [editingAnime, setEditingAnime] = useState<AnimeItem | null>(null);

  // Episode & Playback Source Manager
  const [selectedAnimeForEps, setSelectedAnimeForEps] = useState<AnimeItem | null>(null);
  const [episodes, setEpisodes] = useState<EpisodeItem[]>([]);
  const [editingEpisode, setEditingEpisode] = useState<EpisodeItem | null>(null);
  const [validatingSource, setValidatingSource] = useState(false);

  // Discord Community Form
  const [discordForm, setDiscordForm] = useState<Omit<CommunitySettings, 'id' | 'updatedAt'>>({
    serverName: 'AniMayX Official Discord',
    description: 'Join seasonal watch parties, discuss manga chapters, and get support.',
    inviteUrl: '',
    iconUrl: '',
    supportInviteUrl: '',
    announcementsInviteUrl: '',
    showInHeader: true,
    showHomeCard: true,
    showFooter: true,
    showFloatingButton: false,
    enabled: false,
  });

  const loadCatalog = useCallback(async () => {
    setLoadingCatalog(true);
    try {
      const items = await listAdminFirestoreAnime(collectionTarget);
      setCatalog(items);
    } catch (err) {
      showToast('Failed to load catalogue', 'error', err instanceof Error ? err.message : 'Check admin rules.');
    } finally {
      setLoadingCatalog(false);
    }
  }, [collectionTarget, showToast]);

  const loadSyncStatus = useCallback(async () => {
    try {
      const res = await apiGet<{
        nextScheduledAt: string;
        firestoreAdminConfigured: boolean;
        jobs: SyncJob[];
        logs: SyncLog[];
      }>('/api/admin/sync/status', true);
      setSyncJobs(res.jobs || []);
      setSyncLogs(res.logs || []);
      setNextSyncAt(res.nextScheduledAt);
      setFirestoreAdminSdk(Boolean(res.firestoreAdminConfigured));
    } catch {
      // Ignore if unauthorized
    }
  }, []);

  const loadConsumetConfig = useCallback(async () => {
    try {
      const res = await apiGet<{ configured: boolean; baseUrl: string }>('/api/admin/consumet-config', true);
      setConsumetConfigured(Boolean(res.configured));
      setConsumetUrlInput(res.baseUrl || '');
    } catch {
      // Ignore if unauthorized
    }
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    loadSyncStatus();
    loadConsumetConfig();
  }, [loadSyncStatus, loadConsumetConfig]);

  useEffect(() => {
    if (discord) {
      setDiscordForm({
        serverName: discord.serverName || 'AniMayX Official Discord',
        description: discord.description || '',
        inviteUrl: discord.inviteUrl || '',
        iconUrl: discord.iconUrl || '',
        supportInviteUrl: discord.supportInviteUrl || '',
        announcementsInviteUrl: discord.announcementsInviteUrl || '',
        showInHeader: discord.showInHeader,
        showHomeCard: discord.showHomeCard,
        showFooter: discord.showFooter,
        showFloatingButton: discord.showFloatingButton,
        enabled: discord.enabled,
      });
    }
  }, [discord]);

  const handleSearchProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importQuery.trim()) return;
    try {
      const res = await apiGet<{ items: AnimeItem[] }>(
        `/api/admin/search-provider?provider=anilist&type=${collectionTarget === 'animeMovies' ? 'MOVIE' : 'ANIME'}&q=${encodeURIComponent(
          importQuery.trim()
        )}`,
        true
      );
      setImportResults(res.items || []);
    } catch (err) {
      showToast('Search failed', 'error', err instanceof Error ? err.message : 'Provider error.');
    }
  };

  const startNewManualAnime = () => {
    const id = `manual_${Date.now()}`;
    setEditingAnime({
      id,
      titleRomaji: '',
      titleEnglish: '',
      titleNative: '',
      synopsis: '',
      posterUrl: '',
      bannerUrl: '',
      genres: [],
      seasonYear: new Date().getFullYear(),
      format: collectionTarget === 'animeMovies' ? 'MOVIE' : 'TV',
      episodeCount: 12,
      languages: ['Japanese'],
      status: 'draft',
      featured: false,
      hasAuthorizedPlayback: false,
      sourceProvider: 'manual',
    });
  };

  const handleSaveAnime = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAnime || !user) return;
    try {
      await saveAdminAnime(editingAnime, collectionTarget, user.uid);
      showToast('Title saved', 'success', `${editingAnime.titleEnglish || editingAnime.titleRomaji} (${editingAnime.status})`);
      setEditingAnime(null);
      await loadCatalog();
    } catch (err) {
      showToast('Save failed', 'error', err instanceof Error ? err.message : 'Check fields and permissions.');
    }
  };

  const handleDeleteAnime = async (animeId: string) => {
    try {
      await deleteAdminAnime(animeId, collectionTarget);
      showToast('Title removed', 'info');
      await loadCatalog();
    } catch (err) {
      showToast('Delete failed', 'error', err instanceof Error ? err.message : 'Unable to delete.');
    }
  };

  const openEpisodesFor = async (anime: AnimeItem) => {
    setSelectedAnimeForEps(anime);
    setTab('episodes');
    const eps = await listEpisodesForAnime(anime.id, true);
    setEpisodes(eps);
  };

  const startNewEpisode = () => {
    if (!selectedAnimeForEps) return;
    const nextNum = episodes.length > 0 ? Math.max(...episodes.map((e) => e.episodeNumber)) + 1 : 1;
    setEditingEpisode({
      id: `ep_${nextNum}`,
      animeId: selectedAnimeForEps.id,
      seasonNumber: 1,
      episodeNumber: nextNum,
      title: `Episode ${nextNum}`,
      description: '',
      durationSeconds: 1440,
      thumbnailUrl: selectedAnimeForEps.bannerUrl || selectedAnimeForEps.posterUrl,
      status: 'published',
      playbackSources: [],
      subtitles: [],
    });
  };

  const addPlaybackSourceRow = () => {
    if (!editingEpisode) return;
    const next: PlaybackSource = {
      id: `src_${Date.now()}`,
      label: 'Primary HLS',
      url: '',
      type: 'hls',
      quality: '1080p',
      language: 'Japanese',
      audioTrack: 'Original',
    };
    setEditingEpisode({
      ...editingEpisode,
      playbackSources: [...editingEpisode.playbackSources, next],
    });
  };

  const addSubtitleRow = () => {
    if (!editingEpisode) return;
    const next: SubtitleTrack = {
      id: `sub_${Date.now()}`,
      label: 'English',
      lang: 'en',
      url: '',
      format: 'vtt',
      isDefault: editingEpisode.subtitles.length === 0,
    };
    setEditingEpisode({
      ...editingEpisode,
      subtitles: [...editingEpisode.subtitles, next],
    });
  };

  const validateSourceUrl = async (url: string, type: string) => {
    setValidatingSource(true);
    try {
      const res = await apiPost<{ valid: boolean; message: string }>(
        '/api/admin/validate-source',
        { url, type },
        true
      );
      showToast(res.valid ? 'Source reachable' : 'Validation warning', res.valid ? 'success' : 'warning', res.message);
    } catch (err) {
      showToast('Validation error', 'error', err instanceof Error ? err.message : 'Invalid URL.');
    } finally {
      setValidatingSource(false);
    }
  };

  const handleSaveEpisode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEpisode || !selectedAnimeForEps || !user) return;
    try {
      await saveAdminEpisode(selectedAnimeForEps.id, editingEpisode);
      const updatedEps = await listEpisodesForAnime(selectedAnimeForEps.id, true);
      setEpisodes(updatedEps);
      const hasAnyPlayback = updatedEps.some((ep) => ep.status === 'published' && ep.playbackSources.length > 0);
      if (selectedAnimeForEps.hasAuthorizedPlayback !== hasAnyPlayback) {
        const updatedAnime = { ...selectedAnimeForEps, hasAuthorizedPlayback: hasAnyPlayback };
        await saveAdminAnime(updatedAnime, collectionTarget, user.uid);
        setSelectedAnimeForEps(updatedAnime);
      }
      setEditingEpisode(null);
      showToast('Episode saved', 'success');
    } catch (err) {
      showToast('Episode save failed', 'error', err instanceof Error ? err.message : 'Unable to save episode.');
    }
  };

  const handleSyncNow = async () => {
    setSyncingNow(true);
    try {
      const res = await apiPost<{ started: boolean; reason?: string }>('/api/admin/sync/now', {}, true);
      if (!res.started) {
        showToast('Sync already running', 'warning', res.reason);
      } else {
        showToast('Synchronization completed', 'success');
      }
      await loadSyncStatus();
    } catch (err) {
      showToast('Sync error', 'error', err instanceof Error ? err.message : 'Failed to trigger sync.');
    } finally {
      setSyncingNow(false);
    }
  };

  const handleSaveConsumetUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConsumet(true);
    try {
      const res = await apiPost<{ configured: boolean; baseUrl: string }>(
        '/api/admin/consumet-config',
        { baseUrl: consumetUrlInput.trim() },
        true
      );
      setConsumetConfigured(Boolean(res.configured));
      setConsumetUrlInput(res.baseUrl || '');
      showToast(
        res.configured ? 'Consumet API connected' : 'Consumet API cleared',
        res.configured ? 'success' : 'info'
      );
    } catch (err) {
      showToast('Consumet config error', 'error', err instanceof Error ? err.message : 'Invalid URL.');
    } finally {
      setSavingConsumet(false);
    }
  };

  const handleSaveDiscord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const allowedRegex = /^$|^https:\/\/(discord\.gg|discord\.com\/invite|discordapp\.com\/invite)\/[a-zA-Z0-9_-]+$/i;
    if (
      !allowedRegex.test(discordForm.inviteUrl.trim()) ||
      !allowedRegex.test(discordForm.supportInviteUrl.trim()) ||
      !allowedRegex.test(discordForm.announcementsInviteUrl.trim())
    ) {
      showToast('Invalid Discord URL', 'error', 'Only https://discord.gg/... or https://discord.com/invite/... links are allowed.');
      return;
    }

    try {
      await saveDiscordCommunitySettings(
        {
          ...discordForm,
          inviteUrl: discordForm.inviteUrl.trim(),
          supportInviteUrl: discordForm.supportInviteUrl.trim(),
          announcementsInviteUrl: discordForm.announcementsInviteUrl.trim(),
        },
        user.uid
      );
      await refreshCommunity();
      showToast('Discord settings saved', 'success');
    } catch (err) {
      showToast('Failed to save Discord settings', 'error', err instanceof Error ? err.message : 'Check permissions.');
    }
  };

  const publishedCount = catalog.filter((c) => c.status === 'published').length;
  const draftCount = catalog.filter((c) => c.status === 'draft').length;
  const streamReadyCount = catalog.filter((c) => c.hasAuthorizedPlayback).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/8 pb-6">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white">Anime Admin Console</h1>
          <p className="text-sm text-[#A0A0A0] mt-1">
            Manage catalogue titles, authorized episode sources, automatic sync, and Discord community settings
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5 bg-[#121212] p-1 rounded-lg border border-white/10">
          {[
            { id: 'catalogue', label: 'Catalogue & Import' },
            { id: 'episodes', label: 'Episode Manager' },
            { id: 'sync', label: 'Sync Engine' },
            { id: 'discord', label: 'Discord Settings' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id as AdminTab)}
              className={`px-3.5 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                tab === t.id ? 'bg-[#FF6A00] text-black' : 'text-[#A0A0A0] hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl bg-[#121212] border border-white/8 p-4">
          <p className="text-xs text-[#A0A0A0]">Total Managed Titles</p>
          <p className="font-mono text-2xl font-bold text-white mt-1 tabular-nums">{catalog.length}</p>
        </div>
        <div className="rounded-xl bg-[#121212] border border-white/8 p-4">
          <p className="text-xs text-[#A0A0A0]">Published</p>
          <p className="font-mono text-2xl font-bold text-emerald-400 mt-1 tabular-nums">{publishedCount}</p>
        </div>
        <div className="rounded-xl bg-[#121212] border border-white/8 p-4">
          <p className="text-xs text-[#A0A0A0]">Drafts</p>
          <p className="font-mono text-2xl font-bold text-amber-400 mt-1 tabular-nums">{draftCount}</p>
        </div>
        <div className="rounded-xl bg-[#121212] border border-white/8 p-4">
          <p className="text-xs text-[#A0A0A0]">Playback Configured</p>
          <p className="font-mono text-2xl font-bold text-[#FF6A00] mt-1 tabular-nums">{streamReadyCount}</p>
        </div>
      </div>

      {/* TAB 1: Catalogue & Import */}
      {tab === 'catalogue' && (
        <div className="space-y-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="inline-flex p-1 rounded-lg bg-[#121212] border border-white/10">
              <button
                type="button"
                onClick={() => setCollectionTarget('anime')}
                className={`px-4 py-1.5 rounded-md text-xs font-semibold ${
                  collectionTarget === 'anime' ? 'bg-white text-black' : 'text-[#A0A0A0]'
                }`}
              >
                Anime Series
              </button>
              <button
                type="button"
                onClick={() => setCollectionTarget('animeMovies')}
                className={`px-4 py-1.5 rounded-md text-xs font-semibold ${
                  collectionTarget === 'animeMovies' ? 'bg-white text-black' : 'text-[#A0A0A0]'
                }`}
              >
                Anime Movies
              </button>
            </div>

            <button
              type="button"
              onClick={startNewManualAnime}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#FF6A00] hover:bg-[#FF7E24] text-black text-xs font-semibold"
            >
              <Plus className="w-4 h-4" />
              Add Manual Entry
            </button>
          </div>

          {/* Search & Import from AniList */}
          <div className="rounded-xl bg-[#121212] border border-white/10 p-5 space-y-4">
            <h2 className="font-display text-base font-bold text-white">Import Metadata from AniList</h2>
            <form onSubmit={handleSearchProvider} className="flex gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[#A0A0A0] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={importQuery}
                  onChange={(e) => setImportQuery(e.target.value)}
                  placeholder="Search AniList title to import as draft or published..."
                  className="w-full h-10 pl-9 pr-3 rounded-lg bg-[#080808] border border-white/12 text-sm text-white focus:outline-none focus:border-[#FF6A00]"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-white text-black text-xs font-semibold hover:bg-white/90"
              >
                Search Provider
              </button>
            </form>

            {importResults.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
                {importResults.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-lg bg-[#080808] border border-white/10 p-3 flex items-center gap-3"
                  >
                    <img
                      src={item.posterUrl}
                      alt={item.titleRomaji}
                      referrerPolicy="no-referrer"
                      className="w-12 h-16 rounded object-cover shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {item.titleEnglish || item.titleRomaji}
                      </p>
                      <p className="text-xs text-[#A0A0A0] truncate">
                        {item.format} · {item.seasonYear || 'TBA'}
                      </p>
                      <button
                        type="button"
                        onClick={() => setEditingAnime({ ...item, status: 'draft' })}
                        className="mt-1.5 text-xs font-semibold text-[#FF6A00] hover:underline"
                      >
                        Review & Import →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Anime Editor Modal/Panel */}
          {editingAnime && (
            <form
              onSubmit={handleSaveAnime}
              className="rounded-xl bg-[#121212] border border-[#FF6A00]/40 p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-bold text-white">
                  Edit Title: {editingAnime.titleEnglish || editingAnime.titleRomaji || 'New Title'}
                </h2>
                <button
                  type="button"
                  onClick={() => setEditingAnime(null)}
                  className="text-xs text-[#A0A0A0] hover:text-white"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <label className="space-y-1 text-xs">
                  <span className="text-[#A0A0A0]">Romaji Title *</span>
                  <input
                    required
                    value={editingAnime.titleRomaji}
                    onChange={(e) => setEditingAnime({ ...editingAnime, titleRomaji: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg bg-[#080808] border border-white/12 text-white"
                  />
                </label>
                <label className="space-y-1 text-xs">
                  <span className="text-[#A0A0A0]">English Title</span>
                  <input
                    value={editingAnime.titleEnglish || ''}
                    onChange={(e) => setEditingAnime({ ...editingAnime, titleEnglish: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg bg-[#080808] border border-white/12 text-white"
                  />
                </label>
                <label className="space-y-1 text-xs">
                  <span className="text-[#A0A0A0]">Publication Status</span>
                  <select
                    value={editingAnime.status}
                    onChange={(e) =>
                      setEditingAnime({ ...editingAnime, status: e.target.value as AnimeItem['status'] })
                    }
                    className="w-full h-10 px-3 rounded-lg bg-[#080808] border border-white/12 text-white"
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="archived">Archived</option>
                  </select>
                </label>
                <label className="space-y-1 text-xs">
                  <span className="text-[#A0A0A0]">Poster URL</span>
                  <input
                    value={editingAnime.posterUrl}
                    onChange={(e) => setEditingAnime({ ...editingAnime, posterUrl: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg bg-[#080808] border border-white/12 text-white"
                  />
                </label>
                <label className="space-y-1 text-xs">
                  <span className="text-[#A0A0A0]">Backdrop Banner URL</span>
                  <input
                    value={editingAnime.bannerUrl}
                    onChange={(e) => setEditingAnime({ ...editingAnime, bannerUrl: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg bg-[#080808] border border-white/12 text-white"
                  />
                </label>
                <label className="space-y-1 text-xs">
                  <span className="text-[#A0A0A0]">Genres (comma separated)</span>
                  <input
                    value={editingAnime.genres.join(', ')}
                    onChange={(e) =>
                      setEditingAnime({
                        ...editingAnime,
                        genres: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                      })
                    }
                    className="w-full h-10 px-3 rounded-lg bg-[#080808] border border-white/12 text-white"
                  />
                </label>
              </div>

              <label className="block space-y-1 text-xs">
                <span className="text-[#A0A0A0]">Synopsis</span>
                <textarea
                  rows={3}
                  value={editingAnime.synopsis}
                  onChange={(e) => setEditingAnime({ ...editingAnime, synopsis: e.target.value })}
                  className="w-full p-3 rounded-lg bg-[#080808] border border-white/12 text-white"
                />
              </label>

              <div className="flex flex-wrap items-center justify-between gap-4">
                <label className="inline-flex items-center gap-2 text-xs text-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingAnime.featured}
                    onChange={(e) => setEditingAnime({ ...editingAnime, featured: e.target.checked })}
                    className="accent-[#FF6A00]"
                  />
                  Feature in Hero Carousel
                </label>

                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-lg bg-[#FF6A00] hover:bg-[#FF7E24] text-black text-xs font-semibold"
                >
                  Save to Firestore
                </button>
              </div>
            </form>
          )}

          {/* Managed Catalogue Table */}
          <div className="rounded-xl bg-[#121212] border border-white/10 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-white/8 flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-white">
                Firestore {collectionTarget === 'anime' ? 'Anime Series' : 'Anime Movies'}
              </h3>
            </div>
            {loadingCatalog ? (
              <p className="p-6 text-sm text-[#A0A0A0]">Loading catalogue...</p>
            ) : catalog.length === 0 ? (
              <p className="p-6 text-sm text-[#A0A0A0]">
                No titles saved in Firestore yet. Search AniList above or add a manual entry.
              </p>
            ) : (
              <div className="divide-y divide-white/8">
                {catalog.map((item) => (
                  <div key={item.id} className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-4 hover:bg-white/[0.02]">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <img
                        src={item.posterUrl}
                        alt={item.titleRomaji}
                        referrerPolicy="no-referrer"
                        className="w-10 h-14 rounded object-cover bg-[#080808] shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">
                          {item.titleEnglish || item.titleRomaji}
                        </p>
                        <p className="text-xs text-[#A0A0A0] font-mono tabular-nums">
                          {item.status.toUpperCase()} · {item.format} · {item.hasAuthorizedPlayback ? 'Stream Ready' : 'Metadata Only'}
                          {item.featured ? ' · Featured' : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEpisodesFor(item)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/12 text-xs text-white hover:border-[#FF6A00]"
                      >
                        <Film className="w-3.5 h-3.5 text-[#FF6A00]" />
                        Episodes
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingAnime(item)}
                        className="p-2 rounded-lg border border-white/12 text-[#A0A0A0] hover:text-white"
                        aria-label="Edit title"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteAnime(item.id)}
                        className="p-2 rounded-lg border border-white/12 text-rose-400 hover:bg-rose-500/10"
                        aria-label="Delete title"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Episode & Playback Source Manager */}
      {tab === 'episodes' && (
        <div className="space-y-6">
          {!selectedAnimeForEps ? (
            <div className="rounded-xl bg-[#121212] border border-white/10 p-8 text-center space-y-3">
              <p className="text-sm text-[#A0A0A0]">
                Select an anime from the Catalogue & Import tab to manage its episodes and authorized playback sources.
              </p>
              <button
                type="button"
                onClick={() => setTab('catalogue')}
                className="px-4 py-2 rounded-lg bg-[#FF6A00] text-black text-xs font-semibold"
              >
                Go to Catalogue
              </button>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-[#121212] border border-white/10 p-4">
                <div>
                  <p className="text-xs text-[#FF6A00]">Managing Episodes For</p>
                  <h2 className="font-display text-lg font-bold text-white">
                    {selectedAnimeForEps.titleEnglish || selectedAnimeForEps.titleRomaji}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={startNewEpisode}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#FF6A00] hover:bg-[#FF7E24] text-black text-xs font-semibold"
                >
                  <Plus className="w-4 h-4" />
                  Add Episode
                </button>
              </div>

              {editingEpisode && (
                <form
                  onSubmit={handleSaveEpisode}
                  className="rounded-xl bg-[#121212] border border-[#FF6A00]/40 p-6 space-y-5"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-base font-bold text-white">
                      Episode {editingEpisode.episodeNumber} Configuration
                    </h3>
                    <button
                      type="button"
                      onClick={() => setEditingEpisode(null)}
                      className="text-xs text-[#A0A0A0] hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                    <label className="space-y-1">
                      <span className="text-[#A0A0A0]">Season #</span>
                      <input
                        type="number"
                        min={1}
                        value={editingEpisode.seasonNumber}
                        onChange={(e) => setEditingEpisode({ ...editingEpisode, seasonNumber: Number(e.target.value) })}
                        className="w-full h-10 px-3 rounded-lg bg-[#080808] border border-white/12 text-white"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-[#A0A0A0]">Episode #</span>
                      <input
                        type="number"
                        min={1}
                        value={editingEpisode.episodeNumber}
                        onChange={(e) => setEditingEpisode({ ...editingEpisode, episodeNumber: Number(e.target.value) })}
                        className="w-full h-10 px-3 rounded-lg bg-[#080808] border border-white/12 text-white"
                      />
                    </label>
                    <label className="space-y-1 sm:col-span-2">
                      <span className="text-[#A0A0A0]">Episode Title *</span>
                      <input
                        required
                        value={editingEpisode.title}
                        onChange={(e) => setEditingEpisode({ ...editingEpisode, title: e.target.value })}
                        className="w-full h-10 px-3 rounded-lg bg-[#080808] border border-white/12 text-white"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-[#A0A0A0]">Duration (sec)</span>
                      <input
                        type="number"
                        min={0}
                        value={editingEpisode.durationSeconds || 0}
                        onChange={(e) =>
                          setEditingEpisode({ ...editingEpisode, durationSeconds: Number(e.target.value) })
                        }
                        className="w-full h-10 px-3 rounded-lg bg-[#080808] border border-white/12 text-white"
                      />
                    </label>
                    <label className="space-y-1 sm:col-span-2">
                      <span className="text-[#A0A0A0]">Thumbnail URL</span>
                      <input
                        value={editingEpisode.thumbnailUrl || ''}
                        onChange={(e) => setEditingEpisode({ ...editingEpisode, thumbnailUrl: e.target.value })}
                        className="w-full h-10 px-3 rounded-lg bg-[#080808] border border-white/12 text-white"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-[#A0A0A0]">Status</span>
                      <select
                        value={editingEpisode.status}
                        onChange={(e) =>
                          setEditingEpisode({ ...editingEpisode, status: e.target.value as EpisodeItem['status'] })
                        }
                        className="w-full h-10 px-3 rounded-lg bg-[#080808] border border-white/12 text-white"
                      >
                        <option value="published">Published</option>
                        <option value="draft">Draft</option>
                      </select>
                    </label>
                  </div>

                  {/* Playback Sources */}
                  <div className="space-y-3 border-t border-white/8 pt-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold text-white">Authorized Playback Sources (HTTPS)</h4>
                      <button
                        type="button"
                        onClick={addPlaybackSourceRow}
                        className="text-xs font-semibold text-[#FF6A00] hover:underline"
                      >
                        + Add Source
                      </button>
                    </div>
                    {editingEpisode.playbackSources.map((src, idx) => (
                      <div key={src.id} className="grid grid-cols-1 sm:grid-cols-6 gap-2 p-3 rounded-lg bg-[#080808] border border-white/10 text-xs">
                        <input
                          placeholder="Label (e.g. Subbed)"
                          value={src.label}
                          onChange={(e) => {
                            const copy = [...editingEpisode.playbackSources];
                            copy[idx] = { ...src, label: e.target.value };
                            setEditingEpisode({ ...editingEpisode, playbackSources: copy });
                          }}
                          className="h-9 px-2.5 rounded bg-[#121212] border border-white/10 text-white"
                        />
                        <input
                          placeholder="https://.../stream.m3u8"
                          value={src.url}
                          onChange={(e) => {
                            const copy = [...editingEpisode.playbackSources];
                            copy[idx] = { ...src, url: e.target.value };
                            setEditingEpisode({ ...editingEpisode, playbackSources: copy });
                          }}
                          className="sm:col-span-2 h-9 px-2.5 rounded bg-[#121212] border border-white/10 text-white"
                        />
                        <select
                          value={src.type}
                          onChange={(e) => {
                            const copy = [...editingEpisode.playbackSources];
                            copy[idx] = { ...src, type: e.target.value as PlaybackSource['type'] };
                            setEditingEpisode({ ...editingEpisode, playbackSources: copy });
                          }}
                          className="h-9 px-2 rounded bg-[#121212] border border-white/10 text-white"
                        >
                          <option value="hls">HLS (.m3u8)</option>
                          <option value="mp4">MP4</option>
                        </select>
                        <select
                          value={src.quality}
                          onChange={(e) => {
                            const copy = [...editingEpisode.playbackSources];
                            copy[idx] = { ...src, quality: e.target.value as PlaybackSource['quality'] };
                            setEditingEpisode({ ...editingEpisode, playbackSources: copy });
                          }}
                          className="h-9 px-2 rounded bg-[#121212] border border-white/10 text-white"
                        >
                          <option value="360p">360p</option>
                          <option value="480p">480p</option>
                          <option value="720p">720p</option>
                          <option value="1080p">1080p</option>
                          <option value="auto">Auto</option>
                        </select>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={validatingSource || !src.url}
                            onClick={() => validateSourceUrl(src.url, src.type)}
                            className="flex-1 h-9 rounded bg-white/10 hover:bg-white/20 text-white font-medium"
                          >
                            Verify
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingEpisode({
                                ...editingEpisode,
                                playbackSources: editingEpisode.playbackSources.filter((_, i) => i !== idx),
                              });
                            }}
                            className="p-2 text-rose-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Subtitle Tracks */}
                  <div className="space-y-3 border-t border-white/8 pt-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold text-white">Subtitle Tracks</h4>
                      <button
                        type="button"
                        onClick={addSubtitleRow}
                        className="text-xs font-semibold text-[#FF6A00] hover:underline"
                      >
                        + Add Subtitle
                      </button>
                    </div>
                    {editingEpisode.subtitles.map((sub, idx) => (
                      <div key={sub.id} className="grid grid-cols-1 sm:grid-cols-4 gap-2 p-3 rounded-lg bg-[#080808] border border-white/10 text-xs">
                        <input
                          placeholder="Label (English)"
                          value={sub.label}
                          onChange={(e) => {
                            const copy = [...editingEpisode.subtitles];
                            copy[idx] = { ...sub, label: e.target.value };
                            setEditingEpisode({ ...editingEpisode, subtitles: copy });
                          }}
                          className="h-9 px-2.5 rounded bg-[#121212] border border-white/10 text-white"
                        />
                        <input
                          placeholder="Lang (en)"
                          value={sub.lang}
                          onChange={(e) => {
                            const copy = [...editingEpisode.subtitles];
                            copy[idx] = { ...sub, lang: e.target.value };
                            setEditingEpisode({ ...editingEpisode, subtitles: copy });
                          }}
                          className="h-9 px-2.5 rounded bg-[#121212] border border-white/10 text-white"
                        />
                        <input
                          placeholder="https://.../subs.vtt"
                          value={sub.url}
                          onChange={(e) => {
                            const copy = [...editingEpisode.subtitles];
                            copy[idx] = { ...sub, url: e.target.value };
                            setEditingEpisode({ ...editingEpisode, subtitles: copy });
                          }}
                          className="h-9 px-2.5 rounded bg-[#121212] border border-white/10 text-white"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setEditingEpisode({
                              ...editingEpisode,
                              subtitles: editingEpisode.subtitles.filter((_, i) => i !== idx),
                            })
                          }
                          className="text-rose-400 text-left px-2"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-lg bg-[#FF6A00] hover:bg-[#FF7E24] text-black text-xs font-semibold"
                  >
                    Save Episode
                  </button>
                </form>
              )}

              <div className="divide-y divide-white/8 rounded-xl bg-[#121212] border border-white/10">
                {episodes.length === 0 ? (
                  <p className="p-6 text-sm text-[#A0A0A0]">No episodes created yet for this title.</p>
                ) : (
                  episodes.map((ep) => (
                    <div key={ep.id} className="px-5 py-3.5 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-white">
                          S{ep.seasonNumber} · EP {ep.episodeNumber}: {ep.title}
                        </p>
                        <p className="text-xs text-[#A0A0A0] font-mono tabular-nums">
                          {ep.status.toUpperCase()} · {ep.playbackSources.length} source(s) · {ep.subtitles.length} subtitle(s)
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingEpisode(ep)}
                          className="p-2 rounded-lg border border-white/12 text-[#A0A0A0] hover:text-white"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await deleteAdminEpisode(selectedAnimeForEps.id, ep.id);
                            setEpisodes((prev) => prev.filter((item) => item.id !== ep.id));
                          }}
                          className="p-2 rounded-lg border border-white/12 text-rose-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 3: Automatic Catalogue Sync Engine */}
      {tab === 'sync' && (
        <div className="space-y-6">
          <div className="rounded-xl bg-[#121212] border border-white/10 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="font-display text-lg font-bold text-white">Automated Metadata Synchronization</h2>
              <p className="text-xs text-[#A0A0A0] font-mono tabular-nums">
                Next scheduled sync: {nextSyncAt ? new Date(nextSyncAt).toLocaleString() : 'Pending'} · Interval: 60 min
              </p>
              {!firestoreAdminSdk && (
                <p className="text-xs text-amber-400">
                  Server Firebase Admin SDK service account not configured; synced results are cached on server memory until FIREBASE_SERVICE_ACCOUNT_JSON is set.
                </p>
              )}
            </div>
            <button
              type="button"
              disabled={syncingNow}
              onClick={handleSyncNow}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#FF6A00] hover:bg-[#FF7E24] disabled:opacity-50 text-black text-xs font-semibold shrink-0"
            >
              <RefreshCw className={`w-4 h-4 ${syncingNow ? 'animate-spin' : ''}`} />
              {syncingNow ? 'Syncing...' : 'Sync Now'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {syncJobs.map((job) => (
              <div key={job.id} className="rounded-xl bg-[#121212] border border-white/10 p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-white">{job.provider}</p>
                  {job.status === 'completed' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  )}
                </div>
                <p className="text-xs text-[#A0A0A0]">
                  Category: {job.category} · Status: {job.status}
                </p>
                <p className="text-xs font-mono text-[#A0A0A0] tabular-nums">
                  Imported: {job.importedCount} · Last Success:{' '}
                  {job.lastSuccessAt ? new Date(job.lastSuccessAt).toLocaleTimeString() : 'Never'}
                </p>
                {job.errorMessage && (
                  <p className="text-xs text-rose-400">{job.errorMessage}</p>
                )}
              </div>
            ))}
          </div>

          {/* Consumet API Fastify Server Integration */}
          <form
            onSubmit={handleSaveConsumetUrl}
            className="rounded-xl bg-[#121212] border border-white/10 p-6 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-base font-bold text-white">
                  Consumet API Server Integration
                </h3>
                <p className="text-xs text-[#A0A0A0] mt-0.5">
                  Connect your deployed Consumet Fastify backend to power /meta, /anime, /manga, /movies, /light-novels, /comics, and /books routes (90 req/min guard active).
                </p>
              </div>
              <span
                className={`text-xs font-mono font-semibold ${
                  consumetConfigured ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {consumetConfigured ? 'CONNECTED' : 'NOT CONFIGURED'}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="url"
                value={consumetUrlInput}
                onChange={(e) => setConsumetUrlInput(e.target.value)}
                placeholder="https://your-consumet-server.example.com"
                className="flex-1 h-10 px-3 rounded-lg bg-[#080808] border border-white/12 text-sm text-white placeholder-[#A0A0A0]/60 focus:outline-none focus:border-[#FF6A00]"
              />
              <button
                type="submit"
                disabled={savingConsumet}
                className="px-5 py-2 rounded-lg bg-[#FF6A00] hover:bg-[#FF7E24] disabled:opacity-50 text-black text-xs font-semibold shrink-0"
              >
                {savingConsumet ? 'Saving...' : 'Save Consumet URL'}
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 pt-1 text-[11px] font-mono text-[#A0A0A0]">
              {['/meta', '/anime', '/manga', '/movies', '/light-novels', '/comics', '/books'].map((prefix) => (
                <div key={prefix} className="rounded bg-[#080808] border border-white/8 px-2.5 py-1.5 text-center truncate">
                  {prefix}
                </div>
              ))}
            </div>
          </form>

          <div className="rounded-xl bg-[#121212] border border-white/10 overflow-hidden">
            <div className="px-5 py-3 border-b border-white/8">
              <h3 className="text-sm font-bold text-white">Recent Synchronization Logs</h3>
            </div>
            <div className="max-h-72 overflow-y-auto divide-y divide-white/5 font-mono text-xs">
              {syncLogs.map((log) => (
                <div key={log.id} className="px-5 py-2.5 flex items-center justify-between gap-4">
                  <span className={log.level === 'error' ? 'text-rose-400' : 'text-[#A0A0A0]'}>
                    [{log.provider}] {log.message}
                  </span>
                  <span className="text-[#A0A0A0]/70 shrink-0 tabular-nums">
                    {new Date(log.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Discord Community Settings */}
      {tab === 'discord' && (
        <form onSubmit={handleSaveDiscord} className="rounded-xl bg-[#121212] border border-white/10 p-6 space-y-5 max-w-3xl">
          <div className="flex items-center gap-2.5">
            <MessageSquare className="w-5 h-5 text-[#FF6A00]" />
            <h2 className="font-display text-lg font-bold text-white">Official Discord Community Settings</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <label className="space-y-1">
              <span className="text-[#A0A0A0]">Server Name *</span>
              <input
                required
                value={discordForm.serverName}
                onChange={(e) => setDiscordForm({ ...discordForm, serverName: e.target.value })}
                className="w-full h-10 px-3 rounded-lg bg-[#080808] border border-white/12 text-white"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[#A0A0A0]">Official Invite URL (https://discord.gg/...)</span>
              <input
                value={discordForm.inviteUrl}
                onChange={(e) => setDiscordForm({ ...discordForm, inviteUrl: e.target.value })}
                placeholder="https://discord.gg/your-invite"
                className="w-full h-10 px-3 rounded-lg bg-[#080808] border border-white/12 text-white"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[#A0A0A0]">Support Server Invite (optional)</span>
              <input
                value={discordForm.supportInviteUrl}
                onChange={(e) => setDiscordForm({ ...discordForm, supportInviteUrl: e.target.value })}
                placeholder="https://discord.gg/..."
                className="w-full h-10 px-3 rounded-lg bg-[#080808] border border-white/12 text-white"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[#A0A0A0]">Announcements Invite (optional)</span>
              <input
                value={discordForm.announcementsInviteUrl}
                onChange={(e) => setDiscordForm({ ...discordForm, announcementsInviteUrl: e.target.value })}
                placeholder="https://discord.gg/..."
                className="w-full h-10 px-3 rounded-lg bg-[#080808] border border-white/12 text-white"
              />
            </label>
          </div>

          <label className="block space-y-1 text-xs">
            <span className="text-[#A0A0A0]">Server Description</span>
            <textarea
              rows={2}
              value={discordForm.description}
              onChange={(e) => setDiscordForm({ ...discordForm, description: e.target.value })}
              className="w-full p-3 rounded-lg bg-[#080808] border border-white/12 text-white"
            />
          </label>

          <label className="block space-y-1 text-xs">
            <span className="text-[#A0A0A0]">Custom Server Icon URL (optional)</span>
            <input
              value={discordForm.iconUrl}
              onChange={(e) => setDiscordForm({ ...discordForm, iconUrl: e.target.value })}
              placeholder="https://..."
              className="w-full h-10 px-3 rounded-lg bg-[#080808] border border-white/12 text-white"
            />
          </label>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs text-white pt-2">
            {[
              { key: 'enabled', label: 'Enable Discord Integration' },
              { key: 'showInHeader', label: 'Show Header Button' },
              { key: 'showHomeCard', label: 'Show Home Community Card' },
              { key: 'showFooter', label: 'Show Footer Link' },
              { key: 'showFloatingButton', label: 'Show Floating Button' },
            ].map((toggle) => (
              <label key={toggle.key} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(discordForm[toggle.key as keyof typeof discordForm])}
                  onChange={(e) =>
                    setDiscordForm({ ...discordForm, [toggle.key]: e.target.checked })
                  }
                  className="accent-[#FF6A00]"
                />
                <span>{toggle.label}</span>
              </label>
            ))}
          </div>

          <button
            type="submit"
            className="px-5 py-2.5 rounded-lg bg-[#FF6A00] hover:bg-[#FF7E24] text-black text-xs font-semibold"
          >
            Save Discord Settings
          </button>
        </form>
      )}
    </div>
  );
}
