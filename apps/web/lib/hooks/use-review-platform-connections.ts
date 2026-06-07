"use client";

import { useCallback, useEffect, useState } from "react";

export type ReviewPlatformConnections = {
  loading: boolean;
  googleConnected: boolean;
  facebookConnected: boolean;
  refresh: () => void;
};

export function useReviewPlatformConnections(
  restaurantId: string | null,
): ReviewPlatformConnections {
  const [loading, setLoading] = useState(true);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [facebookConnected, setFacebookConnected] = useState(false);

  const load = useCallback(async () => {
    if (!restaurantId) {
      setGoogleConnected(false);
      setFacebookConnected(false);
      setLoading(true);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/reviews/channels-status?${new URLSearchParams({ restaurantId })}`,
      );
      const body = (await res.json()) as {
        googleConnected?: boolean;
        facebookConnected?: boolean;
      };
      if (res.ok) {
        setGoogleConnected(Boolean(body.googleConnected));
        setFacebookConnected(Boolean(body.facebookConnected));
      }
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    loading,
    googleConnected,
    facebookConnected,
    refresh: load,
  };
}
