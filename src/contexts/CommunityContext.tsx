import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiGet } from '../lib/apiClient';
import { getDiscordCommunitySettings } from '../lib/firestoreService';
import type { CommunitySettings } from '../lib/types';

interface CommunityContextValue {
  discord: CommunitySettings | null;
  widgetPresenceCount: number | null;
  loading: boolean;
  refreshCommunity: () => Promise<void>;
}

const CommunityContext = createContext<CommunityContextValue | null>(null);

export function CommunityProvider({ children }: { children: React.ReactNode }) {
  const [discord, setDiscord] = useState<CommunitySettings | null>(null);
  const [widgetPresenceCount, setWidgetPresenceCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshCommunity = useCallback(async () => {
    setLoading(true);
    try {
      const settings = await getDiscordCommunitySettings();
      setDiscord(settings);
      if (settings?.enabled) {
        const widget = await apiGet<{ widgetAvailable: boolean; presenceCount?: number | null }>(
          '/api/community/discord-widget'
        ).catch(() => ({ widgetAvailable: false, presenceCount: null }));
        setWidgetPresenceCount(widget.widgetAvailable ? widget.presenceCount ?? null : null);
      } else {
        setWidgetPresenceCount(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshCommunity();
  }, [refreshCommunity]);

  return (
    <CommunityContext.Provider value={{ discord, widgetPresenceCount, loading, refreshCommunity }}>
      {children}
    </CommunityContext.Provider>
  );
}

export function useCommunity() {
  const ctx = useContext(CommunityContext);
  if (!ctx) throw new Error('useCommunity must be used within CommunityProvider');
  return ctx;
}
