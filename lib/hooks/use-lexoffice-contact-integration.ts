"use client";

import { useCallback, useEffect, useState } from "react";

export type LexofficeContactIntegrationState = {
  loading: boolean;
  platformEnabled: boolean;
  connected: boolean;
  refresh: () => void;
};

export function useLexofficeContactIntegration(
  restaurantId: string | null,
): LexofficeContactIntegrationState {
  const [loading, setLoading] = useState(true);
  const [platformEnabled, setPlatformEnabled] = useState(false);
  const [connected, setConnected] = useState(false);

  const load = useCallback(async () => {
    if (!restaurantId) {
      setPlatformEnabled(false);
      setConnected(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/contacts/lexoffice-status?${new URLSearchParams({ restaurantId })}`,
      );
      const body = (await res.json()) as {
        platformEnabled?: boolean;
        connected?: boolean;
      };
      if (res.ok) {
        setPlatformEnabled(Boolean(body.platformEnabled));
        setConnected(Boolean(body.connected));
      } else {
        setPlatformEnabled(false);
        setConnected(false);
      }
    } catch {
      setPlatformEnabled(false);
      setConnected(false);
    }
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    loading,
    platformEnabled,
    connected,
    refresh: load,
  };
}
