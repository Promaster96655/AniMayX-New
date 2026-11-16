import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Film, Play } from 'lucide-react';

export interface MediaCardProps {
  to: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  metaItems?: Array<string | number | undefined | null>;
  hasWatchableStream?: boolean;
}

export function MediaCard({
  to,
  title,
  subtitle,
  imageUrl,
  metaItems = [],
  hasWatchableStream = false,
}: MediaCardProps) {
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const cleanMeta = metaItems.filter((m) => m !== undefined && m !== null && String(m).trim() !== '');

  return (
    <Link
      to={to}
      className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6A00] rounded-lg"
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-[#121212] border border-white/8 transition-transform duration-200 ease-out group-hover:-translate-y-1 group-hover:border-[#FF6A00]/60">
        {imageUrl && !imgError ? (
          <>
            {!imgLoaded && (
              <div className="absolute inset-0 bg-[#151515] animate-pulse" />
            )}
            <img
              src={imageUrl}
              alt={title}
              loading="lazy"
              referrerPolicy="no-referrer"
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
              className={`h-full w-full object-cover transition-all duration-300 ease-out group-hover:scale-[1.05] ${
                imgLoaded ? 'opacity-100' : 'opacity-0'
              }`}
            />
          </>
        ) : (
          <div className="h-full w-full flex flex-col items-center justify-center p-4 text-center bg-gradient-to-br from-[#1A1410] via-[#121212] to-[#080808]">
            <Film className="w-7 h-7 text-[#FF6A00]/75 mb-2" />
            <span className="text-xs font-medium text-[#A0A0A0] line-clamp-3">{title}</span>
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#080808] via-[#080808]/45 to-transparent" />

        {hasWatchableStream && (
          <div className="absolute bottom-2.5 right-2.5 w-8 h-8 rounded-full bg-[#FF6A00] text-black flex items-center justify-center shadow-lg transition-transform duration-200 group-hover:scale-110">
            <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
          </div>
        )}
      </div>

      <div className="mt-2.5 space-y-0.5">
        <h3 className="font-display text-sm font-semibold text-white leading-snug line-clamp-1 group-hover:text-[#FF6A00] transition-colors">
          {title}
        </h3>
        {subtitle && (
          <p className="text-xs text-[#A0A0A0] line-clamp-1">{subtitle}</p>
        )}
        {cleanMeta.length > 0 && (
          <p className="text-xs text-[#A0A0A0] tabular-nums line-clamp-1">
            {cleanMeta.map((item, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && <span className="mx-1.5 text-white/25" aria-hidden="true">·</span>}
                <span>{item}</span>
              </React.Fragment>
            ))}
          </p>
        )}
      </div>
    </Link>
  );
}
