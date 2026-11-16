import React from 'react';

export function LoadingScreen({ label = 'Loading AniMayX' }: { label?: string }) {
  return (
    <div className="min-h-screen bg-[#080808] text-white flex flex-col items-center justify-center px-6">
      <div className="relative flex flex-col items-center gap-5">
        <div className="w-12 h-12 rounded-xl border border-white/10 bg-[#121212] flex items-center justify-center relative overflow-hidden">
          <div className="w-6 h-6 rounded-full border-2 border-[#FF6A00] border-t-transparent animate-spin" />
        </div>
        <div className="text-center">
          <p className="font-display text-lg font-bold tracking-tight text-white">
            AniMay<span className="text-[#FF6A00]">X</span>
          </p>
          <p className="mt-1 text-xs text-[#A0A0A0]">{label}</p>
        </div>
      </div>
    </div>
  );
}
