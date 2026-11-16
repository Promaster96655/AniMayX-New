import React from 'react';

export function HeroSkeleton() {
  return (
    <div className="w-full h-[460px] md:h-[540px] bg-[#121212] animate-pulse relative overflow-hidden">
      <div className="max-w-7xl mx-auto h-full px-4 sm:px-8 flex flex-col justify-end pb-14 gap-4">
        <div className="h-4 w-36 bg-white/10 rounded" />
        <div className="h-10 w-80 max-w-full bg-white/10 rounded" />
        <div className="h-4 w-[480px] max-w-full bg-white/10 rounded" />
        <div className="flex gap-3 pt-2">
          <div className="h-10 w-32 bg-[#FF6A00]/30 rounded-lg" />
          <div className="h-10 w-32 bg-white/10 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function PosterGridSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="animate-pulse">
          <div className="aspect-[2/3] w-full rounded-lg bg-[#121212] border border-white/5" />
          <div className="mt-2.5 h-4 w-4/5 bg-white/10 rounded" />
          <div className="mt-1.5 h-3 w-1/2 bg-white/5 rounded" />
        </div>
      ))}
    </div>
  );
}

export function TableRowsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="divide-y divide-white/5">
      {Array.from({ length: rows }).map((_, idx) => (
        <div key={idx} className="py-3.5 px-4 flex items-center justify-between gap-4 animate-pulse">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-14 rounded bg-white/10 shrink-0" />
            <div className="space-y-2 flex-1">
              <div className="h-4 w-48 bg-white/10 rounded" />
              <div className="h-3 w-32 bg-white/5 rounded" />
            </div>
          </div>
          <div className="h-7 w-20 bg-white/10 rounded" />
        </div>
      ))}
    </div>
  );
}
