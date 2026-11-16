import React, { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Search, Menu, X, User, Shield, LogOut, Bookmark, Sparkles, MessageSquare } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useCommunity } from '../contexts/CommunityContext';
import { apiGet } from '../lib/apiClient';
import type { AnimeItem, MangaDexItem } from '../lib/types';

export function Navbar() {
  const { user, profile, isAdmin, logout } = useAuth();
  const { discord } = useCommunity();
  const navigate = useNavigate();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [animeResults, setAnimeResults] = useState<AnimeItem[]>([]);
  const [mangaResults, setMangaResults] = useState<MangaDexItem[]>([]);

  const isUnlocked = Boolean(user && profile?.setupCompleted);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setUserMenuOpen(false);
        setMobileOpen(false);
      }
      if (isUnlocked && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isUnlocked]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!searchOpen || trimmed.length < 2) {
      setAnimeResults([]);
      setMangaResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const [aRes, mRes] = await Promise.all([
          apiGet<{ items: AnimeItem[] }>(`/api/anime/discover?q=${encodeURIComponent(trimmed)}&perPage=5`).catch(() => ({
            items: [],
          })),
          apiGet<{ items: MangaDexItem[] }>(`/api/manga/discover?q=${encodeURIComponent(trimmed)}&page=1`).catch(() => ({
            items: [],
          })),
        ]);
        setAnimeResults(aRes.items.slice(0, 5));
        setMangaResults(mRes.items.slice(0, 4));
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, searchOpen]);

  const discordValid =
    discord?.enabled &&
    discord.showInHeader &&
    /^https:\/\/(discord\.gg|discord\.com\/invite|discordapp\.com\/invite)\/[a-zA-Z0-9_-]+$/i.test(
      discord.inviteUrl || ''
    );

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `text-sm font-medium whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
      isActive
        ? 'text-white border-[#FF6A00]'
        : 'text-[#A0A0A0] border-transparent hover:text-white'
    }`;

  return (
    <>
      <header className="sticky top-0 z-40 bg-[#080808]/95 backdrop-blur-md border-b border-white/8">
        <div className="max-w-7xl mx-auto h-16 px-4 sm:px-8 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <Link
            to={isUnlocked ? '/' : user ? '/setup-profile' : '/register'}
            className="font-display text-xl font-extrabold tracking-tight text-white whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6A00] rounded"
          >
            AniMay<span className="text-[#FF6A00]">X</span>
          </Link>

          {/* Zone 2: Concise single-line Navigation Links */}
          {isUnlocked ? (
            <nav className="hidden lg:flex items-center gap-6" aria-label="Primary">
              <NavLink to="/" end className={navLinkClass}>
                Home
              </NavLink>
              <NavLink to="/anime" className={navLinkClass}>
                Anime
              </NavLink>
              <NavLink to="/movies" className={navLinkClass}>
                Movies & TV
              </NavLink>
              <NavLink to="/manga" className={navLinkClass}>
                Manga
              </NavLink>
              <NavLink to="/novels" className={navLinkClass}>
                Novels & Comics
              </NavLink>
              {discordValid && (
                <a
                  href={discord.inviteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-[#A0A0A0] hover:text-[#FF6A00] whitespace-nowrap shrink-0 py-1 transition-colors inline-flex items-center gap-1.5"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-[#FF6A00]" />
                  Discord
                </a>
              )}
            </nav>
          ) : (
            <nav className="hidden sm:flex items-center gap-6 text-sm text-[#A0A0A0]" aria-label="Onboarding steps">
              <span className={!user ? 'text-white font-medium' : 'text-emerald-400'}>
                1. Create Account
              </span>
              <span className="text-white/20">·</span>
              <span className={user && !profile?.setupCompleted ? 'text-[#FF6A00] font-medium' : ''}>
                2. Profile Tutorial
              </span>
              <span className="text-white/20">·</span>
              <span>3. Watch & Explore</span>
            </nav>
          )}

          {/* Zone 3: Search + Primary Action / Account */}
          <div className="flex items-center gap-3 shrink-0">
            {isUnlocked && (
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                aria-label="Search catalogue"
                className="h-10 px-3 rounded-lg bg-[#121212] border border-white/10 text-[#A0A0A0] hover:text-white hover:border-white/25 transition-colors inline-flex items-center gap-2 text-xs whitespace-nowrap shrink-0"
              >
                <Search className="w-4 h-4" />
                <span className="hidden sm:inline">Search</span>
              </button>
            )}

            {user ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((v) => !v)}
                  className="h-10 pl-1.5 pr-3 rounded-lg bg-[#121212] border border-white/10 hover:border-[#FF6A00]/60 transition-colors inline-flex items-center gap-2 text-sm text-white whitespace-nowrap shrink-0"
                >
                  {profile?.avatarUrl ? (
                    <img
                      src={profile.avatarUrl}
                      alt={profile.displayName}
                      referrerPolicy="no-referrer"
                      className="w-7 h-7 rounded-md object-cover"
                    />
                  ) : (
                    <User className="w-4 h-4 text-[#FF6A00]" />
                  )}
                  <span className="hidden sm:inline max-w-[110px] truncate font-medium">
                    {profile?.displayName || 'Account'}
                  </span>
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-xl bg-[#121212] border border-white/10 shadow-2xl py-2 z-50">
                    <div className="px-4 py-2 border-b border-white/8">
                      <p className="text-sm font-semibold text-white truncate">
                        {profile?.displayName || 'Member'}
                      </p>
                      <p className="text-xs text-[#A0A0A0] truncate">
                        @{profile?.username || 'setup'}
                      </p>
                    </div>
                    {isUnlocked && (
                      <>
                        <Link
                          to="/profile"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#A0A0A0] hover:text-white hover:bg-white/5"
                        >
                          <User className="w-4 h-4" />
                          My Profile
                        </Link>
                        <Link
                          to="/anime/watchlist"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#A0A0A0] hover:text-white hover:bg-white/5"
                        >
                          <Bookmark className="w-4 h-4" />
                          My Watchlist
                        </Link>
                      </>
                    )}
                    <Link
                      to="/setup-profile"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#A0A0A0] hover:text-white hover:bg-white/5"
                    >
                      <Sparkles className="w-4 h-4" />
                      {isUnlocked ? 'Customize Profile' : 'Profile Setup Tutorial'}
                    </Link>
                    {isAdmin && (
                      <Link
                        to="/admin/anime"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#FF6A00] hover:bg-white/5 font-medium"
                      >
                        <Shield className="w-4 h-4" />
                        Anime Admin Panel
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={async () => {
                        setUserMenuOpen(false);
                        await logout();
                        navigate('/register');
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-rose-400 hover:bg-white/5 border-t border-white/8 mt-1"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="h-10 px-3.5 rounded-lg border border-white/12 text-white hover:border-white/30 text-sm font-medium inline-flex items-center justify-center transition-colors whitespace-nowrap shrink-0"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="h-10 px-4 rounded-lg bg-[#FF6A00] hover:bg-[#FF7E24] text-black text-sm font-semibold inline-flex items-center justify-center transition-colors whitespace-nowrap shrink-0"
                >
                  Sign Up
                </Link>
              </div>
            )}

            {isUnlocked && (
              <button
                type="button"
                onClick={() => setMobileOpen((v) => !v)}
                aria-label="Toggle navigation menu"
                className="lg:hidden h-10 w-10 rounded-lg bg-[#121212] border border-white/10 flex items-center justify-center text-white"
              >
                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            )}
          </div>
        </div>

        {/* Mobile drawer */}
        {isUnlocked && mobileOpen && (
          <nav className="lg:hidden border-t border-white/8 bg-[#080808] px-4 py-4 space-y-2">
            {[
              { to: '/', label: 'Home' },
              { to: '/anime', label: 'Anime' },
              { to: '/anime/browse', label: 'Browse Anime' },
              { to: '/movies', label: 'Movies & Web Series' },
              { to: '/manga', label: 'Manga' },
              { to: '/novels', label: 'Light Novels' },
              { to: '/comics', label: 'Comics' },
              { to: '/anime/watchlist', label: 'Watchlist' },
            ].map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className="block py-2.5 px-3 rounded-lg text-sm font-medium text-[#A0A0A0] hover:text-white hover:bg-[#121212]"
              >
                {item.label}
              </Link>
            ))}
            {discordValid && (
              <a
                href={discord.inviteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium text-[#FF6A00] hover:bg-[#121212]"
              >
                <MessageSquare className="w-4 h-4" />
                Join Discord Community
              </a>
            )}
          </nav>
        )}
      </header>

      {/* Instant Search Suggestions Modal */}
      {isUnlocked && searchOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start justify-center pt-16 px-4"
          onClick={() => setSearchOpen(false)}
        >
          <div
            className="w-full max-w-2xl rounded-xl bg-[#121212] border border-white/15 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!query.trim()) return;
                setSearchOpen(false);
                navigate(`/anime/browse?q=${encodeURIComponent(query.trim())}`);
              }}
              className="flex items-center gap-3 px-4 py-3.5 border-b border-white/10"
            >
              <Search className="w-5 h-5 text-[#FF6A00] shrink-0" />
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search anime, movies, manga, light novels..."
                className="flex-1 bg-transparent text-white placeholder-[#A0A0A0] text-sm focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="text-xs text-[#A0A0A0] hover:text-white px-2 py-1"
              >
                Esc
              </button>
            </form>

            <div className="max-h-[65vh] overflow-y-auto p-4 space-y-5">
              {query.trim().length < 2 && (
                <p className="text-xs text-[#A0A0A0] text-center py-6">
                  Type at least 2 characters for live AniList & MangaDex suggestions, or press Enter to search all Anime.
                </p>
              )}

              {searching && (
                <p className="text-xs text-[#A0A0A0] text-center py-4">Searching providers...</p>
              )}

              {!searching && animeResults.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-[#A0A0A0] mb-2">Anime</h4>
                  <div className="space-y-1.5">
                    {animeResults.map((a) => (
                      <Link
                        key={a.id}
                        to={`/anime/${a.id}`}
                        onClick={() => setSearchOpen(false)}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors"
                      >
                        <img
                          src={a.posterUrl}
                          alt={a.titleEnglish || a.titleRomaji}
                          referrerPolicy="no-referrer"
                          className="w-9 h-12 rounded object-cover bg-[#181818] shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-white truncate">
                            {a.titleEnglish || a.titleRomaji}
                          </p>
                          <p className="text-xs text-[#A0A0A0] truncate">
                            {a.format} · {a.seasonYear || 'TBA'}
                            {a.averageScore ? ` · ${a.averageScore}%` : ''}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {!searching && mangaResults.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-[#A0A0A0] mb-2">Manga</h4>
                  <div className="space-y-1.5">
                    {mangaResults.map((m) => (
                      <Link
                        key={m.id}
                        to={`/manga/${m.id}`}
                        onClick={() => setSearchOpen(false)}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors"
                      >
                        <img
                          src={m.coverUrl}
                          alt={m.title}
                          referrerPolicy="no-referrer"
                          className="w-9 h-12 rounded object-cover bg-[#181818] shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-white truncate">{m.title}</p>
                          <p className="text-xs text-[#A0A0A0] truncate">
                            MangaDex · {m.status}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
