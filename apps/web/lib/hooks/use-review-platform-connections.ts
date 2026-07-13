"use client";

import { useCallback, useEffect, useState } from "react";

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
  const [loading, setLoading] = useState(true);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [facebookConnected, setFacebookConnected] = useState(false);
  const [tripadvisorConnected, setTripadvisorConnected] = useState(false);
  const [googleVisible, setGoogleVisible] = useState(false);
  const [facebookVisible, setFacebookVisible] = useState(false);
  const [tripadvisorVisible, setTripadvisorVisible] = useState(false);

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
    setLoading(true);
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
        setGoogleConnected(Boolean(body.googleConnected));
        setFacebookConnected(Boolean(body.facebookConnected));
        setTripadvisorConnected(Boolean(body.tripadvisorConnected));
        setGoogleVisible(Boolean(body.googleVisible));
        setFacebookVisible(Boolean(body.facebookVisible));
        setTripadvisorVisible(Boolean(body.tripadvisorVisible));
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
    tripadvisorConnected,
    googleVisible,
    facebookVisible,
    tripadvisorVisible,
    refresh: load,
  };
}
