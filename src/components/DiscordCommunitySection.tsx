import React from 'react';
import { ExternalLink, MessageSquare, Megaphone, LifeBuoy } from 'lucide-react';
import { useCommunity } from '../contexts/CommunityContext';

function isAllowedDiscordInvite(url?: string): boolean {
  if (!url) return false;
  return /^https:\/\/(discord\.gg|discord\.com\/invite|discordapp\.com\/invite)\/[a-zA-Z0-9_-]+$/i.test(
    url.trim()
  );
}

export function DiscordHomeCard() {
  const { discord, widgetPresenceCount } = useCommunity();

  if (!discord?.enabled || !discord.showHomeCard || !isAllowedDiscordInvite(discord.inviteUrl)) {
    return null;
  }

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-8 py-8">
      <div className="rounded-xl bg-[#121212] border border-white/10 p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-start gap-4 max-w-2xl">
          {discord.iconUrl ? (
            <img
              src={discord.iconUrl}
              alt={discord.serverName}
              referrerPolicy="no-referrer"
              className="w-12 h-12 rounded-xl object-cover border border-white/10 shrink-0"
            />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-[#FF6A00]/15 border border-[#FF6A00]/30 flex items-center justify-center shrink-0">
              <MessageSquare className="w-6 h-6 text-[#FF6A00]" />
            </div>
          )}
          <div className="space-y-1.5">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="font-display text-lg sm:text-xl font-bold text-white">
                {discord.serverName}
              </h2>
              {widgetPresenceCount !== null && (
                <span className="text-xs font-mono text-[#A0A0A0] tabular-nums">
                  {widgetPresenceCount.toLocaleString()} online now
                </span>
              )}
            </div>
            <p className="text-sm text-[#A0A0A0] leading-relaxed">
              {discord.description ||
                'Join the official AniMayX community on Discord for seasonal watch parties, release updates, and support.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {isAllowedDiscordInvite(discord.announcementsInviteUrl) && (
            <a
              href={discord.announcementsInviteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-white/12 text-xs font-medium text-white hover:border-white/30 transition-colors whitespace-nowrap"
            >
              <Megaphone className="w-3.5 h-3.5 text-[#FF6A00]" />
              Announcements
            </a>
          )}
          {isAllowedDiscordInvite(discord.supportInviteUrl) && (
            <a
              href={discord.supportInviteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-white/12 text-xs font-medium text-white hover:border-white/30 transition-colors whitespace-nowrap"
            >
              <LifeBuoy className="w-3.5 h-3.5 text-[#FF6A00]" />
              Support
            </a>
          )}
          <a
            href={discord.inviteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#FF6A00] hover:bg-[#FF7E24] text-black text-sm font-semibold transition-colors whitespace-nowrap"
          >
            Join Discord
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    </section>
  );
}

export function DiscordFloatingButton() {
  const { discord } = useCommunity();

  if (
    !discord?.enabled ||
    !discord.showFloatingButton ||
    !isAllowedDiscordInvite(discord.inviteUrl)
  ) {
    return null;
  }

  return (
    <a
      href={discord.inviteUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Join ${discord.serverName} on Discord`}
      className="fixed bottom-5 left-5 z-40 inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#121212] border border-[#FF6A00]/40 text-white text-xs font-semibold shadow-xl hover:border-[#FF6A00] hover:text-[#FF6A00] transition-colors"
    >
      <MessageSquare className="w-4 h-4 text-[#FF6A00]" />
      <span>Community</span>
    </a>
  );
}
