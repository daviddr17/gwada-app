"use client";

import { useEffect, useState } from "react";
import type { ShareSourceType } from "@/lib/constants/share-channels";
import type { ShareChannelPublicInfo } from "@/lib/share/share-types";

export function useShareChannelsStatus(
  restaurantId: string | null,
  sourceType: ShareSourceType,
) {
  const [channels, setChannels] = useState<ShareChannelPublicInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!restaurantId) {
      setChannels([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ restaurantId, sourceType });
        const res = await fetch(`/api/share/channels-status?${params}`);
        const data = (await res.json()) as {
          channels?: ShareChannelPublicInfo[];
        };
        if (!cancelled) setChannels(data.channels ?? []);
      } catch {
        if (!cancelled) setChannels([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [restaurantId, sourceType]);

  const connectedChannels = channels.filter((c) => c.connected);
  const hasConnectedChannel = connectedChannels.length > 0;

  return { channels, connectedChannels, hasConnectedChannel, loading };
}
