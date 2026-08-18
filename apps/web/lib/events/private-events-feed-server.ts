import "server-only";

import { mapPrivateEventReservationToFeedItem } from "@/lib/events/private-event-item";
import type { UnifiedEventItem } from "@/lib/events/unified-event-item";
import { RESERVATION_KIND_PRIVATE_EVENT } from "@/lib/reservations/reservation-kind";
import {
  mapRawToReservationListRow,
  RESERVATION_LIST_ROW_SELECT,
} from "@/lib/supabase/reservations-db";
import type { SupabaseClient } from "@supabase/supabase-js";

const PRIVATE_EVENT_FEED_LIMIT = 200;

export async function readPrivateEventsForDashboardFeed(
  restaurantId: string,
  sb: SupabaseClient,
): Promise<UnifiedEventItem[]> {
  const { data, error } = await sb
    .from("reservations")
    .select(RESERVATION_LIST_ROW_SELECT)
    .eq("restaurant_id", restaurantId)
    .eq("kind", RESERVATION_KIND_PRIVATE_EVENT)
    .order("starts_at", { ascending: false })
    .limit(PRIVATE_EVENT_FEED_LIMIT);

  if (error) {
    console.warn("[gwada] private events feed", error.message);
    return [];
  }

  const items: UnifiedEventItem[] = [];
  for (const raw of data ?? []) {
    const row = mapRawToReservationListRow(raw as Record<string, unknown>);
    const item = mapPrivateEventReservationToFeedItem(row);
    if (item) items.push(item);
  }
  return items;
}
