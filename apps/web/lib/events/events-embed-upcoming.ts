import type { UnifiedEventItem } from "@/lib/events/unified-event-item";

/** Grace period: events that started within the last 24h still count as upcoming. */
export const EVENTS_EMBED_UPCOMING_GRACE_MS = 24 * 60 * 60 * 1000;

export function isUpcomingEmbedEvent(
  item: Pick<UnifiedEventItem, "startAt">,
  nowMs: number = Date.now(),
): boolean {
  return new Date(item.startAt).getTime() >= nowMs - EVENTS_EMBED_UPCOMING_GRACE_MS;
}

export function splitEmbedEventsByUpcoming(
  items: UnifiedEventItem[],
  nowMs: number = Date.now(),
): { upcoming: UnifiedEventItem[]; past: UnifiedEventItem[] } {
  const upcoming: UnifiedEventItem[] = [];
  const past: UnifiedEventItem[] = [];
  for (const item of items) {
    if (isUpcomingEmbedEvent(item, nowMs)) upcoming.push(item);
    else past.push(item);
  }
  return { upcoming, past };
}
