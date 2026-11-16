export type ThemeId =
  | 'classic-orange'
  | 'midnight-black'
  | 'crimson-edge'
  | 'golden-legend'
  | 'anime-collector'
  | 'seasonal-frame';

export interface UserProfile {
  uid: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  bannerUrl: string;
  frameId: string;
  themeId: ThemeId;
  bio: string;
  favoriteGenres: string[];
  badges: string[];
  watchlistVisibility: 'public' | 'private';
  setupCompleted: boolean;
  joinDate: string;
  updatedAt: string;
}

export interface UserPrivateInfo {
  uid: string;
  email: string;
  preferredLanguage: string;
  preferredSubtitleLang: string;
  skipIntroEnabled: boolean;
  updatedAt: string;
}

export interface PlaybackSource {
  id: string;
  label: string;
  url: string;
  type: 'hls' | 'mp4' | 'dash';
  quality: '360p' | '480p' | '720p' | '1080p' | '1440p' | '2160p' | 'auto';
  language: string;
  audioTrack?: string;
}

export interface SubtitleTrack {
  id: string;
  label: string;
  lang: string;
  url: string;
  format: 'vtt' | 'srt' | 'ass';
  isDefault?: boolean;
}

export interface AnimeItem {
  id: string;
  anilistId?: number;
  malId?: number;
  titleEnglish?: string;
  titleRomaji: string;
  titleNative?: string;
  synopsis: string;
  posterUrl: string;
  bannerUrl: string;
  genres: string[];
  season?: string;
  seasonYear?: number;
  format: string;
  episodeCount?: number;
  averageScore?: number;
  popularity?: number;
  trendingRank?: number;
  languages: string[];
  status: 'draft' | 'published' | 'archived';
  featured: boolean;
  hasAuthorizedPlayback: boolean;
  sourceProvider: 'anilist' | 'jikan' | 'manual';
  adminLockedFields?: string[];
  trailerUrl?: string;
  studios?: string[];
  chapters?: number;
  volumes?: number;
  airingStatus?: string;
}

export interface EpisodeItem {
  id: string;
  animeId: string;
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  description?: string;
  durationSeconds?: number;
  thumbnailUrl?: string;
  status: 'draft' | 'published' | 'archived';
  playbackSources: PlaybackSource[];
  subtitles: SubtitleTrack[];
}

export interface WatchlistEntry {
  userId: string;
  mediaId: string;
  category: 'anime' | 'anime_movie' | 'movie' | 'series' | 'manga' | 'novel' | 'comic';
  title: string;
  posterUrl?: string;
  watchStatus: 'watching' | 'planned' | 'completed' | 'on_hold' | 'dropped';
  isPublic: boolean;
  updatedAt: string;
}

export interface WatchProgressEntry {
  userId: string;
  animeId: string;
  animeTitle?: string;
  posterUrl?: string;
  episodeNumber: number;
  positionSeconds: number;
  durationSeconds: number;
  completed: boolean;
  updatedAt: string;
}

export interface CommunitySettings {
  id: string;
  serverName: string;
  description: string;
  inviteUrl: string;
  iconUrl: string;
  supportInviteUrl: string;
  announcementsInviteUrl: string;
  showInHeader: boolean;
  showHomeCard: boolean;
  showFooter: boolean;
  showFloatingButton: boolean;
  enabled: boolean;
  updatedAt?: string;
}

export interface TmdbMediaItem {
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

export interface MangaDexItem {
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

export interface SyncJob {
  id: string;
  provider: string;
  category: string;
  status: 'idle' | 'running' | 'completed' | 'failed' | 'unconfigured';
  lastSuccessAt: string | null;
  lastAttemptAt: string | null;
  nextScheduledAt: string | null;
  importedCount: number;
  errorMessage: string | null;
}

export interface SyncLog {
  id: string;
  provider: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  createdAt: string;
}

export interface AniSkipResult {
  available: boolean;
  op?: { startTime: number; endTime: number };
  ed?: { startTime: number; endTime: number };
  episodeLength?: number;
}

