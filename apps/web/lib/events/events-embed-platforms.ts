import {
  EVENTS_FILTER_ALL,
  EVENTS_NATIVE_PLATFORMS,
  EVENTS_PLATFORM_ORDER,
  type EventsPlatform,
  type EventsPlatformFilter,
} from "@/lib/constants/events-platforms";

export function defaultEventsPlatformFilterWithoutAll(
  connectedPlatforms: readonly EventsPlatform[],
): EventsPlatformFilter {
  const first = EVENTS_PLATFORM_ORDER.find((platform) =>
    connectedPlatforms.includes(platform),
  );
  return first ?? EVENTS_FILTER_ALL;
}

export type EventsEmbedPlatforms = Record<
  (typeof EVENTS_NATIVE_PLATFORMS)[number],
  boolean
>;

export function defaultEventsEmbedPlatforms(): EventsEmbedPlatforms {
  return Object.fromEntries(
    EVENTS_NATIVE_PLATFORMS.map((platform) => [platform, true]),
  ) as EventsEmbedPlatforms;
}

export function normalizeEventsEmbedPlatforms(raw: unknown): EventsEmbedPlatforms {
  const result = defaultEventsEmbedPlatforms();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return result;
  }
  const record = raw as Record<string, unknown>;
  for (const platform of EVENTS_NATIVE_PLATFORMS) {
    const value = record[platform];
    if (typeof value === "boolean") {
      result[platform] = value;
    }
  }
  return result;
}

export function isEventsEmbedPlatformEnabled(
  platforms: EventsEmbedPlatforms,
  platform: (typeof EVENTS_NATIVE_PLATFORMS)[number],
): boolean {
  return platforms[platform] !== false;
}

export function filterPlatformsForEventsEmbed(
  connectedPlatforms: EventsPlatform[],
  embedPlatforms: EventsEmbedPlatforms,
): EventsPlatform[] {
  return connectedPlatforms.filter((platform) =>
    isEventsEmbedPlatformEnabled(
      embedPlatforms,
      platform as (typeof EVENTS_NATIVE_PLATFORMS)[number],
    ),
  );
}

export function filterItemsForEventsEmbed<T extends { platform: EventsPlatform }>(
  items: T[],
  embedPlatforms: EventsEmbedPlatforms,
): T[] {
  return items.filter((item) => {
    if (!(EVENTS_NATIVE_PLATFORMS as readonly string[]).includes(item.platform)) {
      return false;
    }
    return isEventsEmbedPlatformEnabled(
      embedPlatforms,
      item.platform as (typeof EVENTS_NATIVE_PLATFORMS)[number],
    );
  });
}
