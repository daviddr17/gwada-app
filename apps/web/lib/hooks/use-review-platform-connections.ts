"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import {
  peekReviewsChannelsCache,
  writeReviewsChannelsCache,
} from "@/lib/reviews/reviews-channels-client-cache";

export type ReviewPlatformConnections = {
  loading: boolean;
  googleConnected: boolean;
  facebookConnected: boolean;
  tripadvisorConnected: boolean;
  googleVisible: boolean;
  facebookVisible: boolean;
  tripadvisorVisible: boolean;
  refresh: () => void;
};

export function useReviewPlatformConnections(
  restaurantId: string | null,
): ReviewPlatformConnections {
  const [loading, setLoading] = useState(() => {
    if (!restaurantId) return true;
    return peekReviewsChannelsCache(restaurantId) == null;
  });
  const [googleConnected, setGoogleConnected] = useState(false);
  const [facebookConnected, setFacebookConnected] = useState(false);
  const [tripadvisorConnected, setTripadvisorConnected] = useState(false);
  const [googleVisible, setGoogleVisible] = useState(false);
  const [facebookVisible, setFacebookVisible] = useState(false);
  const [tripadvisorVisible, setTripadvisorVisible] = useState(false);

  const applyCached = useCallback((restaurantIdValue: string) => {
    const cached = peekReviewsChannelsCache(restaurantIdValue);
    if (!cached) return false;
    setGoogleConnected(cached.googleConnected);
    setFacebookConnected(cached.facebookConnected);
    setTripadvisorConnected(cached.tripadvisorConnected);
    setGoogleVisible(cached.googleVisible);
    setFacebookVisible(cached.facebookVisible);
    setTripadvisorVisible(cached.tripadvisorVisible);
    setLoading(false);
    return true;
  }, []);

  useLayoutEffect(() => {
    if (!restaurantId) return;
    applyCached(restaurantId);
  }, [restaurantId, applyCached]);

  const load = useCallback(async () => {
    if (!restaurantId) {
      setGoogleConnected(false);
      setFacebookConnected(false);
      setTripadvisorConnected(false);
      setGoogleVisible(false);
      setFacebookVisible(false);
      setTripadvisorVisible(false);
      setLoading(true);
      return;
    }
    const hadCache = applyCached(restaurantId);
    if (!hadCache) setLoading(true);
    try {
      const res = await fetch(
        `/api/reviews/channels-status?${new URLSearchParams({ restaurantId })}`,
      );
      const body = (await res.json()) as {
        googleConnected?: boolean;
        facebookConnected?: boolean;
        tripadvisorConnected?: boolean;
        googleVisible?: boolean;
        facebookVisible?: boolean;
        tripadvisorVisible?: boolean;
      };
      if (res.ok) {
        const next = {
          googleConnected: Boolean(body.googleConnected),
          facebookConnected: Boolean(body.facebookConnected),
          tripadvisorConnected: Boolean(body.tripadvisorConnected),
          googleVisible: Boolean(body.googleVisible),
          facebookVisible: Boolean(body.facebookVisible),
          tripadvisorVisible: Boolean(body.tripadvisorVisible),
        };
        setGoogleConnected(next.googleConnected);
        setFacebookConnected(next.facebookConnected);
        setTripadvisorConnected(next.tripadvisorConnected);
        setGoogleVisible(next.googleVisible);
        setFacebookVisible(next.facebookVisible);
        setTripadvisorVisible(next.tripadvisorVisible);
        writeReviewsChannelsCache(restaurantId, next);
      }
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, [restaurantId, applyCached]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    loading,
    googleConnected,
    facebookConnected,
    tripadvisorConnected,
    googleVisible,
    facebookVisible,
    tripadvisorVisible,
    refresh: load,
  };
}
