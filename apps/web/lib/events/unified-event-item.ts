import type { EventsPlatform } from "@/lib/constants/events-platforms";

export type UnifiedEventItem = {
  id: string;
  platform: EventsPlatform;
  source: "gwada" | "external";
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
};
