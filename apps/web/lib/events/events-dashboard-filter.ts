import {
  EVENTS_FILTER_ALL,
  isEventsPlatformFilter,
  type EventsPlatformFilter,
} from "@/lib/constants/events-platforms";

/** Dashboard-only: private Veranstaltungen in der Events-Timeline. */
export const EVENTS_FILTER_PRIVATE = "private" as const;

export type EventsDashboardFilter =
  | EventsPlatformFilter
  | typeof EVENTS_FILTER_PRIVATE;

export const EVENTS_FILTER_PRIVATE_LABEL = "Privat";

export function isEventsDashboardFilter(
  value: string,
): value is EventsDashboardFilter {
  return value === EVENTS_FILTER_PRIVATE || isEventsPlatformFilter(value);
}

export function parseEventsDashboardFilter(
  raw: string | null | undefined,
): EventsDashboardFilter {
  if (!raw || raw === EVENTS_FILTER_ALL) return EVENTS_FILTER_ALL;
  if (raw === EVENTS_FILTER_PRIVATE) return EVENTS_FILTER_PRIVATE;
  if (isEventsPlatformFilter(raw)) return raw;
  return EVENTS_FILTER_ALL;
}
