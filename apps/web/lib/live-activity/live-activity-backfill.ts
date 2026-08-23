"use client";

import { restaurantTodayYmd } from "@/lib/restaurant/restaurant-timezone";
import { mergeLiveActivityItems } from "@/lib/live-activity/live-activity-store";
import type { LiveActivityItem } from "@/lib/live-activity/live-activity-types";

let inflight: Promise<void> | null = null;
let lastBackfillKey: string | null = null;

/** Lädt heutige notification_events vom Server und ergänzt den lokalen Feed. */
export function backfillLiveActivityFeed(
  restaurantId: string,
  dayKey: string = restaurantTodayYmd(),
): Promise<void> {
  const key = `${restaurantId}:${dayKey}`;
  if (lastBackfillKey === key && inflight) return inflight;

  lastBackfillKey = key;
  inflight = (async () => {
    try {
      const q = new URLSearchParams({ restaurantId });
      const res = await fetch(`/api/dashboard/live-activity-feed?${q}`, {
        cache: "no-store",
        credentials: "include",
      });
      if (!res.ok) return;
      const body = (await res.json()) as { data?: LiveActivityItem[] };
      if (!body.data?.length) return;
      mergeLiveActivityItems(restaurantId, body.data, dayKey);
    } catch {
      /* offline */
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}
