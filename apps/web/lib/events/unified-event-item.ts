import type { EventsPlatform } from "@/lib/constants/events-platforms";

export type UnifiedEventItem = {
  id: string;
  platform: EventsPlatform;
  source: "gwada" | "external" | "private";
  eventId: string | null;
  title: string;
  description: string;
  coverUrl: string | null;
  coverStoragePath: string | null;
  startAt: string;
  endAt: string | null;
  ticketUrl: string | null;
  location: string | null;
  status: "draft" | "scheduled" | "published" | "cancelled" | "failed";
  canEdit: boolean;
  canDelete: boolean;
  externalUrl: string | null;
  createdAt: string;
  publishedAt: string | null;
  /** Max. ein Pin pro Restaurant — sortiert nach oben. */
  isPinned?: boolean;
  /** Nur `source: "private"` — Reservierungs-UUID. */
  reservationId?: string | null;
  partySize?: number | null;
  guestCompany?: string | null;
  statusLabel?: string | null;
};

export function isPrivateEventFeedItem(
  item: Pick<UnifiedEventItem, "source">,
): boolean {
  return item.source === "private";
}
