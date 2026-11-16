export type MediaStatus = 'draft' | 'published' | 'archived';

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

export interface NormalizedAnime {
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
  status: MediaStatus;
  featured: boolean;
  hasAuthorizedPlayback: boolean;
  sourceProvider: 'anilist' | 'jikan' | 'manual';
  adminLockedFields?: string[];
  trailerUrl?: string;
  studios?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface NormalizedEpisode {
  id: string;
  animeId: string;
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  description?: string;
  durationSeconds?: number;
  thumbnailUrl?: string;
  airedAt?: string;
  status: MediaStatus;
  playbackSources: PlaybackSource[];
  subtitles: SubtitleTrack[];
}

export interface AniSkipResult {
  available: boolean;
  op?: { startTime: number; endTime: number };
  ed?: { startTime: number; endTime: number };
  episodeLength?: number;
}

export interface SyncJobState {
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

export interface SyncLogEntry {
  id: string;
  provider: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  createdAt: string;
}
