import {
  EVENTS_FILTER_ALL,
  isEventsPlatformFilter,
  type EventsPlatformFilter,
} from "@/lib/constants/events-platforms";

/** Dashboard-only: private Veranstaltungen in der Events-Timeline. */
export const EVENTS_FILTER_PRIVATE = "private" as const;

/** Dashboard-Übersicht: öffentliche Events (Plattform-Feed, nicht privat). */
export const EVENTS_FILTER_PUBLIC = "public" as const;

export type EventsDashboardFilter =
  | EventsPlatformFilter
  | typeof EVENTS_FILTER_PRIVATE
  | typeof EVENTS_FILTER_PUBLIC;

export const EVENTS_FILTER_PRIVATE_LABEL = "Privat";
export const EVENTS_FILTER_PUBLIC_LABEL = "Öffentlich";

export type EventsAudienceFilter =
  | typeof EVENTS_FILTER_PUBLIC
  | typeof EVENTS_FILTER_PRIVATE;

export function isEventsAudienceFilter(
  value: string,
): value is EventsAudienceFilter {
  return value === EVENTS_FILTER_PUBLIC || value === EVENTS_FILTER_PRIVATE;
}

export function isEventsDashboardFilter(
  value: string,
): value is EventsDashboardFilter {
  return (
    value === EVENTS_FILTER_PRIVATE ||
    value === EVENTS_FILTER_PUBLIC ||
    isEventsPlatformFilter(value)
  );
}

export function parseEventsDashboardFilter(
  raw: string | null | undefined,
): EventsDashboardFilter {
  if (!raw || raw === EVENTS_FILTER_ALL) return EVENTS_FILTER_PUBLIC;
  if (raw === EVENTS_FILTER_PRIVATE) return EVENTS_FILTER_PRIVATE;
  if (raw === EVENTS_FILTER_PUBLIC) return EVENTS_FILTER_PUBLIC;
  if (isEventsPlatformFilter(raw)) return raw;
  return EVENTS_FILTER_PUBLIC;
}

export function parseEventsAudienceFilter(
  raw: string | null | undefined,
): EventsAudienceFilter {
  const parsed = parseEventsDashboardFilter(raw);
  if (parsed === EVENTS_FILTER_PRIVATE) return EVENTS_FILTER_PRIVATE;
  return EVENTS_FILTER_PUBLIC;
}
