"use client";

import { useEffect, useState } from "react";
import type { EventsConnectorPublicInfo } from "@/lib/types/events-connectors";

export function useEventsPlatformConnections(restaurantId: string | null) {
  const [connectors, setConnectors] = useState<EventsConnectorPublicInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!restaurantId) {
      setConnectors([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/events/channels-status?${new URLSearchParams({ restaurantId })}`,
        );
        const data = (await res.json()) as { connectors?: EventsConnectorPublicInfo[] };
        if (!cancelled) setConnectors(data.connectors ?? []);
      } catch {
        if (!cancelled) setConnectors([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  const availablePlatforms = new Set(
    connectors.filter((c) => c.key === "gwada" || c.connected).map((c) => c.key),
  );

  return { connectors, availablePlatforms, loading };
}
