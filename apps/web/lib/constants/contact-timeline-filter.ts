import {
  CONTACT_MESSAGE_PLATFORM_ORDER,
  CONTACT_MESSAGE_PLATFORM_LABELS,
  type ContactMessagePlatform,
} from "@/lib/constants/contact-message-platforms";
import type { ContactTimelineEntry } from "@/lib/supabase/contact-timeline-db";

export type ContactTimelineFilter = {
  showReservations: boolean;
  showMessages: boolean;
  showNotes: boolean;
  messagePlatforms: ContactMessagePlatform[];
};

export const DEFAULT_CONTACT_TIMELINE_FILTER: ContactTimelineFilter = {
  showReservations: true,
  showMessages: true,
  showNotes: true,
  messagePlatforms: [...CONTACT_MESSAGE_PLATFORM_ORDER],
};

export function countContactTimelineActiveFilters(
  filter: ContactTimelineFilter,
): number {
  let n = 0;
  if (!filter.showReservations) n += 1;
  if (!filter.showMessages) n += 1;
  if (!filter.showNotes) n += 1;
  if (
    filter.showMessages &&
    filter.messagePlatforms.length !== CONTACT_MESSAGE_PLATFORM_ORDER.length
  ) {
    n += 1;
  }
  return n;
}

export function resetContactTimelineFilter(): ContactTimelineFilter {
  return { ...DEFAULT_CONTACT_TIMELINE_FILTER };
}

export function filterContactTimelineEntries(
  entries: ContactTimelineEntry[],
  filter: ContactTimelineFilter,
): ContactTimelineEntry[] {
  const platformSet = new Set(filter.messagePlatforms);
  return entries.filter((entry) => {
    if (entry.kind === "reservation") return filter.showReservations;
    if (entry.kind === "message") {
      if (!filter.showMessages) return false;
      if (!entry.messagePlatform) return true;
      return platformSet.has(entry.messagePlatform);
    }
    if (entry.kind === "note" || entry.kind === "legacy_note") {
      return filter.showNotes;
    }
    return true;
  });
}

export const CONTACT_TIMELINE_MESSAGE_PLATFORM_OPTIONS =
  CONTACT_MESSAGE_PLATFORM_ORDER.map((platform) => ({
    platform,
    label: CONTACT_MESSAGE_PLATFORM_LABELS[platform],
  }));
