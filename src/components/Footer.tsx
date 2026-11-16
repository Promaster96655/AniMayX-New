import React from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, MessageSquare } from 'lucide-react';
import { useCommunity } from '../contexts/CommunityContext';

export function Footer() {
  const { discord } = useCommunity();
  const discordValid =
    discord?.enabled &&
    discord.showFooter &&
    /^https:\/\/(discord\.gg|discord\.com\/invite|discordapp\.com\/invite)\/[a-zA-Z0-9_-]+$/i.test(
      discord.inviteUrl || ''
    );

  return (
    <footer className="border-t border-white/8 bg-[#080808] text-[#A0A0A0] mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-12 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="space-y-2.5">
          <Link to="/" className="font-display text-xl font-extrabold tracking-tight text-white">
            AniMay<span className="text-[#FF6A00]">X</span>
          </Link>
          <p className="text-sm text-[#A0A0A0]">Watch Free Animes</p>
          <p className="text-xs text-[#A0A0A0]/80 leading-relaxed">
            Authorized entertainment metadata and streaming platform across anime, cinema, manga, light novels, and comics.
          </p>
        </div>

        <div className="space-y-2.5">
          <h4 className="text-sm font-semibold text-white">Anime</h4>
          <ul className="space-y-2 text-xs">
            <li><Link to="/anime/trending" className="hover:text-white transition-colors">Trending Anime</Link></li>
            <li><Link to="/anime/popular" className="hover:text-white transition-colors">Popular Anime</Link></li>
            <li><Link to="/anime/movies" className="hover:text-white transition-colors">Anime Movies</Link></li>
            <li><Link to="/anime/browse" className="hover:text-white transition-colors">Browse & Filter</Link></li>
          </ul>
        </div>

        <div className="space-y-2.5">
          <h4 className="text-sm font-semibold text-white">Catalogue</h4>
          <ul className="space-y-2 text-xs">
            <li><Link to="/movies" className="hover:text-white transition-colors">Movies & Web Series</Link></li>
            <li><Link to="/manga" className="hover:text-white transition-colors">Manga</Link></li>
            <li><Link to="/novels" className="hover:text-white transition-colors">Light Novels</Link></li>
            <li><Link to="/comics" className="hover:text-white transition-colors">Comics</Link></li>
          </ul>
        </div>

        <div className="space-y-2.5">
          <h4 className="text-sm font-semibold text-white">Community & Attribution</h4>
          {discordValid ? (
            <div className="space-y-2">
              <a
                href={discord.inviteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs font-medium text-[#FF6A00] hover:underline"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                {discord.serverName}
                <ExternalLink className="w-3 h-3" />
              </a>
              <p className="text-xs text-[#A0A0A0]/80">{discord.description}</p>
            </div>
          ) : (
            <p className="text-xs text-[#A0A0A0]/70">
              Community Discord invites can be configured in the Administrator Console.
            </p>
          )}
          <p className="text-[11px] text-[#A0A0A0]/70 pt-2">
            Anime metadata via AniList & Jikan. Skip timings via AniSkip. Film & TV metadata via TMDB (not endorsed or certified by TMDB).
          </p>
        </div>
      </div>

      <div className="border-t border-white/6 py-5 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#A0A0A0]/75">
          <span>© {new Date().getFullYear()} AniMayX. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <Link to="/profile" className="hover:text-white transition-colors">Account</Link>
            <Link to="/anime/watchlist" className="hover:text-white transition-colors">Watchlist</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
