import React, { useEffect, useRef, useState } from 'react';
import Artplayer from 'artplayer';
import Hls from 'hls.js';
import { FastForward, AlertTriangle, SkipForward } from 'lucide-react';
import type { AniSkipResult, PlaybackSource, SubtitleTrack } from '../lib/types';

interface VideoPlayerProps {
  sources: PlaybackSource[];
  subtitles?: SubtitleTrack[];
  posterUrl?: string;
  initialTimeSeconds?: number;
  aniSkip?: AniSkipResult | null;
  skipEnabled?: boolean;
  hasNextEpisode?: boolean;
  onNextEpisode?: () => void;
  onProgressTick?: (positionSeconds: number, durationSeconds: number, completed: boolean) => void;
}

export function VideoPlayer({
  sources,
  subtitles = [],
  posterUrl,
  initialTimeSeconds = 0,
  aniSkip,
  skipEnabled = true,
  hasNextEpisode = false,
  onNextEpisode,
  onProgressTick,
}: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const artRef = useRef<Artplayer | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const lastSavedAtRef = useRef(0);

  const [selectedSourceId, setSelectedSourceId] = useState<string>(sources[0]?.id || '');
  const [selectedSubLang, setSelectedSubLang] = useState<string>(
    subtitles.find((s) => s.isDefault)?.lang || subtitles[0]?.lang || 'off'
  );
  const [currentTime, setCurrentTime] = useState(0);
  const [playerError, setPlayerError] = useState<string | null>(null);

  const activeSource = sources.find((s) => s.id === selectedSourceId) || sources[0];

  useEffect(() => {
    if (sources.length > 0 && !sources.some((s) => s.id === selectedSourceId)) {
      setSelectedSourceId(sources[0].id);
    }
  }, [sources, selectedSourceId]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !activeSource) return;

    setPlayerError(null);

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (artRef.current) {
      artRef.current.destroy(false);
      artRef.current = null;
    }

    const activeSubtitle = subtitles.find((s) => s.lang === selectedSubLang);

    const art = new Artplayer({
      container,
      url: activeSource.url,
      poster: posterUrl || '',
      volume: 0.85,
      isLive: false,
      muted: false,
      autoplay: false,
      pip: true,
      setting: true,
      playbackRate: true,
      aspectRatio: true,
      fullscreen: true,
      fullscreenWeb: true,
      miniProgressBar: true,
      theme: '#FF6A00',
      type: activeSource.type === 'hls' ? 'm3u8' : 'mp4',
      subtitle: activeSubtitle
        ? {
            url: activeSubtitle.url,
            type: activeSubtitle.format,
            style: {
              color: '#FFFFFF',
              fontSize: '20px',
            },
          }
        : undefined,
      customType: {
        m3u8: (video: HTMLMediaElement, url: string) => {
          if (Hls.isSupported()) {
            const hls = new Hls({ enableWorker: true });
            hlsRef.current = hls;
            hls.loadSource(url);
            hls.attachMedia(video);
            hls.on(Hls.Events.ERROR, (_event, data) => {
              if (data.fatal) {
                setPlayerError(
                  'The configured HLS stream could not be loaded (network, CORS, or expired URL).'
                );
              }
            });
          } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = url;
          } else {
            setPlayerError('HLS playback is not supported in this browser.');
          }
        },
      },
    });

    art.on('ready', () => {
      if (initialTimeSeconds > 5 && art.duration > initialTimeSeconds + 5) {
        art.seek = initialTimeSeconds;
      }
    });

    art.on('video:timeupdate', () => {
      const pos = art.currentTime || 0;
      const dur = art.duration || 0;
      setCurrentTime(pos);

      const now = Date.now();
      if (onProgressTick && dur > 0 && now - lastSavedAtRef.current > 8000) {
        lastSavedAtRef.current = now;
        const completed = dur > 0 && pos / dur >= 0.9;
        onProgressTick(pos, dur, completed);
      }
    });

    art.on('video:error', () => {
      setPlayerError('Unable to play the configured media source. Verify stream availability and CORS headers.');
    });

    artRef.current = art;

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (artRef.current) {
        artRef.current.destroy(false);
        artRef.current = null;
      }
    };
  }, [activeSource, selectedSubLang, posterUrl]);

  const activeSkipSegment =
    skipEnabled && aniSkip?.available
      ? aniSkip.op && currentTime >= aniSkip.op.startTime && currentTime < aniSkip.op.endTime
        ? { label: 'Skip Opening', target: aniSkip.op.endTime }
        : aniSkip.ed && currentTime >= aniSkip.ed.startTime && currentTime < aniSkip.ed.endTime
        ? { label: 'Skip Ending', target: aniSkip.ed.endTime }
        : null
      : null;

  if (!activeSource) {
    return (
      <div className="aspect-video w-full rounded-xl bg-[#121212] border border-white/10 flex flex-col items-center justify-center p-6 text-center gap-2">
        <AlertTriangle className="w-8 h-8 text-[#FF6A00]" />
        <p className="text-sm font-medium text-white">No authorized playback source configured</p>
        <p className="text-xs text-[#A0A0A0] max-w-md">
          An administrator must attach an authorized HLS or MP4 source to this episode before playback is available.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-black border border-white/10">
        <div ref={containerRef} className="w-full h-full" />

        {activeSkipSegment && (
          <button
            type="button"
            onClick={() => {
              if (artRef.current) {
                artRef.current.seek = activeSkipSegment.target;
              }
            }}
            className="absolute bottom-16 right-4 z-30 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#FF6A00] hover:bg-[#FF7E24] text-black text-xs font-bold shadow-xl transition-transform hover:scale-105"
          >
            <FastForward className="w-4 h-4" />
            {activeSkipSegment.label}
          </button>
        )}

        {playerError && (
          <div className="absolute inset-0 z-20 bg-black/85 flex flex-col items-center justify-center p-6 text-center gap-2">
            <AlertTriangle className="w-7 h-7 text-rose-400" />
            <p className="text-sm font-medium text-white">Playback Source Unavailable</p>
            <p className="text-xs text-[#A0A0A0] max-w-md">{playerError}</p>
          </div>
        )}
      </div>

      {/* Real Configured Quality / Audio / Subtitle & Episode Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#121212] border border-white/8 p-3.5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#A0A0A0]">Source & Quality:</span>
            <select
              value={activeSource.id}
              onChange={(e) => setSelectedSourceId(e.target.value)}
              className="bg-[#080808] border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#FF6A00]"
            >
              {sources.map((src) => (
                <option key={src.id} value={src.id}>
                  {src.label} · {src.quality} ({src.language}
                  {src.audioTrack ? ` - ${src.audioTrack}` : ''})
                </option>
              ))}
            </select>
          </div>

          {subtitles.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#A0A0A0]">Subtitles:</span>
              <select
                value={selectedSubLang}
                onChange={(e) => setSelectedSubLang(e.target.value)}
                className="bg-[#080808] border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#FF6A00]"
              >
                <option value="off">Off</option>
                {subtitles.map((sub) => (
                  <option key={sub.id} value={sub.lang}>
                    {sub.label} ({sub.lang})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {aniSkip?.available && (
            <span className="text-xs text-[#A0A0A0]">
              AniSkip: {aniSkip.op ? 'OP ' : ''}
              {aniSkip.ed ? 'ED' : ''} ready
            </span>
          )}
          {hasNextEpisode && onNextEpisode && (
            <button
              type="button"
              onClick={onNextEpisode}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#FF6A00] hover:bg-[#FF7E24] text-black text-xs font-semibold transition-colors"
            >
              Next Episode
              <SkipForward className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
