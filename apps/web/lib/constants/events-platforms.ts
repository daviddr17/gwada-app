export const EVENTS_PLATFORMS = [
  "gwada",
  "facebook",
  "google_business",
  "instagram",
  "whatsapp_channel",
] as const;

export type EventsPlatform = (typeof EVENTS_PLATFORMS)[number];

/** Plattformen mit strukturierten Events (Lesen/Sync). */
export const EVENTS_NATIVE_PLATFORMS = [
  "gwada",
  "facebook",
  "google_business",
] as const satisfies readonly EventsPlatform[];

/** Externe Plattformen im DB-Cache (kein Gwada). */
export const EVENTS_CACHEABLE_PLATFORMS = [
  "facebook",
  "google_business",
] as const satisfies readonly EventsPlatform[];

export type EventsCacheablePlatform = (typeof EVENTS_CACHEABLE_PLATFORMS)[number];

/** Nur Ankündigung beim Erstellen — kein Event-Sync. */
export const EVENTS_ANNOUNCEMENT_PLATFORMS = [
  "instagram",
  "whatsapp_channel",
] as const satisfies readonly EventsPlatform[];

export const EVENTS_PLATFORM_LABELS: Record<EventsPlatform, string> = {
  gwada: "Gwada",
  facebook: "Facebook",
  google_business: "Google",
  instagram: "Instagram",
  whatsapp_channel: "WhatsApp Kanal",
};

export const EVENTS_PLATFORM_ORDER: readonly EventsPlatform[] = EVENTS_PLATFORMS;

export function isEventsPlatform(value: string): value is EventsPlatform {
  return (EVENTS_PLATFORMS as readonly string[]).includes(value);
}

export function isEventsCacheablePlatform(
  platform: EventsPlatform,
): platform is EventsCacheablePlatform {
  return (EVENTS_CACHEABLE_PLATFORMS as readonly string[]).includes(platform);
}

export const EVENTS_FILTER_ALL = "all" as const;

export type EventsPlatformFilter = typeof EVENTS_FILTER_ALL | EventsPlatform;

export const EVENTS_FILTER_LABELS: Record<EventsPlatformFilter, string> = {
  all: "Alle",
  ...EVENTS_PLATFORM_LABELS,
};

export function isEventsPlatformFilter(
  value: string,
): value is EventsPlatformFilter {
  return value === EVENTS_FILTER_ALL || isEventsPlatform(value);
}

export function parseEventsPlatformFilter(
  platformParam: string | null,
): EventsPlatformFilter {
  if (!platformParam || platformParam === EVENTS_FILTER_ALL) {
    return EVENTS_FILTER_ALL;
  }
  if (isEventsPlatform(platformParam)) {
    return platformParam;
  }
  return EVENTS_FILTER_ALL;
}

export type EventsViewMode = "grid" | "list";

export function parseEventsViewMode(value: string | null): EventsViewMode {
  return value === "grid" ? "grid" : "list";
}
