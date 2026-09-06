import type { DashboardReservationsListSheetMode } from "@/components/dashboard/dashboard-reservations-list-sheet";
import type { StaffLivePresenceSheetMode } from "@/components/staff/staff-overview-live-presence-sheet";
import type { LiveActivityItem } from "@/lib/live-activity/live-activity-types";

export type HeuteLiveSheetTarget =
  | { type: "reservations"; mode: DashboardReservationsListSheetMode }
  | { type: "messages" }
  | { type: "inventory" }
  | { type: "presence"; mode: StaffLivePresenceSheetMode }
  | { type: "work_hours" }
  | { type: "checklists" }
  | { type: "event"; item: LiveActivityItem };

/** Mappt Live-Feed-Module auf bestehende Heute-Sheets (sonst Event-Detail). */
export function resolveHeuteLiveSheetTarget(
  item: LiveActivityItem,
): HeuteLiveSheetTarget {
  const mod = item.module?.trim() ?? "";
  if (!mod) return { type: "event", item };

  if (
    mod === "reservations_pending" ||
    mod === "reservations_change_request"
  ) {
    return { type: "reservations", mode: "unconfirmed" };
  }
  if (
    mod === "reservations_cancellation" ||
    mod === "reservations_activity" ||
    mod.startsWith("reservations")
  ) {
    return { type: "reservations", mode: "today_upcoming" };
  }

  if (mod === "messages" || mod === "messages_follow_up") {
    return { type: "messages" };
  }

  if (mod.startsWith("inventory_")) {
    return { type: "inventory" };
  }

  if (
    mod === "staff_display_clock_in" ||
    mod === "staff_display_clock_out" ||
    mod === "staff_shift_start" ||
    mod === "staff_shift_end" ||
    mod === "staff_invite_accepted"
  ) {
    return { type: "presence", mode: "working" };
  }

  if (
    mod === "staff_todo_completed" ||
    mod === "staff_todo_deferred" ||
    mod === "personal_reminder"
  ) {
    return { type: "checklists" };
  }

  return { type: "event", item };
}
