"use client";

import { useNotificationBellRealtime } from "@/lib/hooks/use-notification-bell-realtime";

/** Glocke: Realtime auf `notification_events` — einmal pro App-Zone. */
export function AppNotificationBellLive() {
  useNotificationBellRealtime();
  return null;
}
