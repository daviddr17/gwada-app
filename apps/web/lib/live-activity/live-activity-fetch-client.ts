"use client";

import { mergeLiveActivityItems } from "@/lib/live-activity/live-activity-store";
import type { LiveActivityItem } from "@/lib/live-activity/live-activity-types";

export const LIVE_ACTIVITY_PAGE_SIZE = 20;

export type LiveActivityFeedPage = {
  items: LiveActivityItem[];
  hasMore: boolean;
  total: number;
};

let inflightInitial: Promise<LiveActivityFeedPage | null> | null = null;
let lastInitialKey: string | null = null;

export async function fetchLiveActivityFeedPage(
  restaurantId: string,
  options?: { limit?: number; offset?: number },
): Promise<LiveActivityFeedPage | null> {
  const limit = options?.limit ?? LIVE_ACTIVITY_PAGE_SIZE;
  const offset = options?.offset ?? 0;
  const q = new URLSearchParams({
    restaurantId,
    limit: String(limit),
    offset: String(offset),
  });

  try {
    const res = await fetch(`/api/dashboard/live-activity-feed?${q}`, {
      cache: "no-store",
      credentials: "include",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      data?: LiveActivityItem[];
      hasMore?: boolean;
      total?: number;
    };
    const items = body.data ?? [];
    return {
      items,
      hasMore: Boolean(body.hasMore),
      total: typeof body.total === "number" ? body.total : items.length,
    };
  } catch {
    return null;
  }
}

/** Erste Seite vom Server — ergänzt den lokalen Feed ohne Duplikate. */
export async function backfillLiveActivityFeed(
  restaurantId: string,
): Promise<LiveActivityFeedPage | null> {
  const key = restaurantId;
  if (lastInitialKey === key && inflightInitial) {
    return inflightInitial;
  }

  lastInitialKey = key;
  inflightInitial = fetchLiveActivityFeedPage(restaurantId, {
    limit: LIVE_ACTIVITY_PAGE_SIZE,
    offset: 0,
  }).then((page) => {
    if (page?.items.length) {
      mergeLiveActivityItems(restaurantId, page.items);
    }
    return page;
  });

  inflightInitial = inflightInitial.finally(() => {
    inflightInitial = null;
  });

  return inflightInitial;
}
