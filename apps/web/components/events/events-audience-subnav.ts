"use client";

import type { ModuleSubnavItem } from "@/components/layout/module-subnav";
import { APP_ROUTES } from "@/lib/navigation/app-routes";
import {
  EVENTS_FILTER_PRIVATE,
  EVENTS_FILTER_PUBLIC,
  EVENTS_FILTER_PRIVATE_LABEL,
  EVENTS_FILTER_PUBLIC_LABEL,
} from "@/lib/events/events-dashboard-filter";

/** Zweite Chip-Leiste auf der Events-Übersicht — Öffentlich / Privat. */
export const EVENTS_AUDIENCE_SUBNAV: readonly ModuleSubnavItem[] = [
  {
    href: `${APP_ROUTES.events.overview}?filter=${EVENTS_FILTER_PUBLIC}`,
    label: EVENTS_FILTER_PUBLIC_LABEL,
    matchMode: "exact",
  },
  {
    href: `${APP_ROUTES.events.overview}?filter=${EVENTS_FILTER_PRIVATE}`,
    label: EVENTS_FILTER_PRIVATE_LABEL,
    matchMode: "exact",
  },
];
