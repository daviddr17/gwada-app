"use client";

import { useCallback, useEffect, useState } from "react";
import {
  peekReviewPlatformConnectionsCache,
  writeReviewPlatformConnectionsCache,
} from "@/lib/reviews/review-platform-connections-cache";

export type ReviewPlatformConnections = {
  loading: boolean;
  googleConnected: boolean;
  facebookConnected: boolean;
  googleVisible: boolean;
  facebookVisible: boolean;
  refresh: () => void;
};

function applyCachedConnections(
  cached: ReturnType<typeof peekReviewPlatformConnectionsCache>,
): Pick<
  ReviewPlatformConnections,
  "googleConnected" | "facebookConnected" | "googleVisible" | "facebookVisible"
> | null {
  if (!cached) return null;
  return {
    googleConnected: cached.googleConnected,
    facebookConnected: cached.facebookConnected,
    googleVisible: cached.googleVisible,
    facebookVisible: cached.facebookVisible,
  };
}

export function useReviewPlatformConnections(
  restaurantId: string | null,
): ReviewPlatformConnections {
  const cached =
    restaurantId != null ? peekReviewPlatformConnectionsCache(restaurantId) : null;
  const cachedState = applyCachedConnections(cached);

  const [loading, setLoading] = useState(() =>
    restaurantId != null && cachedState != null ? false : Boolean(restaurantId),
  );
  const [googleConnected, setGoogleConnected] = useState(
    () => cachedState?.googleConnected ?? false,
  );
  const [facebookConnected, setFacebookConnected] = useState(
    () => cachedState?.facebookConnected ?? false,
  );
  const [googleVisible, setGoogleVisible] = useState(
    () => cachedState?.googleVisible ?? false,
  );
  const [facebookVisible, setFacebookVisible] = useState(
    () => cachedState?.facebookVisible ?? false,
  );

  const load = useCallback(async () => {
    if (!restaurantId) {
      setGoogleConnected(false);
      setFacebookConnected(false);
      setGoogleVisible(false);
      setFacebookVisible(false);
      setLoading(false);
      return;
    }

    const hasCached = peekReviewPlatformConnectionsCache(restaurantId) != null;
    if (!hasCached) setLoading(true);

    try {
      const res = await fetch(
        `/api/reviews/channels-status?${new URLSearchParams({ restaurantId })}`,
      );
      const body = (await res.json()) as {
        googleConnected?: boolean;
        facebookConnected?: boolean;
        googleVisible?: boolean;
        facebookVisible?: boolean;
      };
      if (res.ok) {
        const next = {
          googleConnected: Boolean(body.googleConnected),
          facebookConnected: Boolean(body.facebookConnected),
          googleVisible: Boolean(body.googleVisible),
          facebookVisible: Boolean(body.facebookVisible),
        };
        setGoogleConnected(next.googleConnected);
        setFacebookConnected(next.facebookConnected);
        setGoogleVisible(next.googleVisible);
        setFacebookVisible(next.facebookVisible);
        writeReviewPlatformConnectionsCache(restaurantId, next);
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
    googleVisible,
    facebookVisible,
    refresh: load,
  };
}
