"use client";

import {
  isNotificationModuleId,
  NOTIFICATION_MODULES,
} from "@/lib/notifications/notification-modules";
import { formatNotificationPayloadSummary } from "@/lib/superadmin/superadmin-notification-log";
import type { LiveActivityItem } from "@/lib/live-activity/live-activity-types";

function pickString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** notification_events → Live-Feed-Zeile. */
export function liveActivityFromNotificationEvent(params: {
  eventId?: string | null;
  module: string;
  payload: Record<string, unknown>;
  createdAt?: string | null;
}): Omit<LiveActivityItem, "id" | "at"> & { id?: string; at?: string } {
  const moduleId = isNotificationModuleId(params.module)
    ? params.module
    : null;
  const def = moduleId ? NOTIFICATION_MODULES[moduleId] : null;
  const summary = formatNotificationPayloadSummary(
    params.module,
    params.payload,
  );
  const guest =
    pickString(params.payload.guest_name) ??
    pickString(params.payload.contact_name) ??
    pickString(params.payload.staff_name) ??
    pickString(params.payload.author_name);
  const title = def?.label ?? params.module;
  const description =
    summary.trim() ||
    guest ||
    pickString(params.payload.title) ||
    pickString(params.payload.body) ||
    null;

  return {
    id: params.eventId ? `evt:${params.eventId}` : undefined,
    kind: "notification",
    module: params.module,
    title,
    description,
    href: def?.href ?? null,
    at: params.createdAt ?? undefined,
  };
}
