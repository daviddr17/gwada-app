"use client";

import { useEffect, useState } from "react";
import type { GalleryConnectorPublicInfo } from "@/lib/types/gallery-connectors";

export function useGalleryPlatformConnections(restaurantId: string | null) {
  const [connectors, setConnectors] = useState<GalleryConnectorPublicInfo[]>([]);
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
          `/api/gallery/channels-status?${new URLSearchParams({ restaurantId })}`,
        );
        const data = (await res.json()) as { connectors?: GalleryConnectorPublicInfo[] };
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
