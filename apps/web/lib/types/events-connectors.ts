import type { EventsPlatform } from "@/lib/constants/events-platforms";

export type EventsConnectorCapabilitiesPublic = {
  canReadFeed: boolean;
  canCreateEvent: boolean;
  canUpdateEvent: boolean;
  canDeleteEvent: boolean;
  /** Nur Ankündigung (Post/Nachricht), kein strukturiertes Event. */
  isAnnouncementOnly: boolean;
  maxCoverCount: number;
};

export type EventsConnectorPublicInfo = {
  key: EventsPlatform;
  displayName: string;
  connected: boolean;
  capabilities: EventsConnectorCapabilitiesPublic;
  externalEditBaseUrl: string | null;
};
