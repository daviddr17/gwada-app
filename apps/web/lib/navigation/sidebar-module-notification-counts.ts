import type { SidebarModuleId } from "@/lib/constants/sidebar-modules";
import type { NotificationModuleId } from "@/lib/notifications/notification-modules";
import type { NotificationSummary } from "@/lib/notifications/notification-types";

/** Ungelesene Changelog-Einträge für Sidebar-Footer (Glocke-Modul „changelog“). */
export function sidebarChangelogUnreadCount(
  summary: NotificationSummary | null | undefined,
): number {
  if (!summary) return 0;
  const mod = summary.modules.find((m) => m.id === "changelog");
  return mod?.count ?? 0;
}

const SIDEBAR_MODULE_NOTIFICATION_IDS: Partial<
  Record<SidebarModuleId, readonly NotificationModuleId[]>
> = {
  reservierungen: ["reservations_pending"],
  kontakte: ["messages"],
  bewertungen: ["reviews"],
  buchfuehrung: [
    "accounting_quotation",
    "accounting_invoice",
    "accounting_voucher",
  ],
  mitarbeiter: ["staff_todo_completed", "staff_todo_deferred"],
};

export function sidebarModuleNotificationCount(
  summary: NotificationSummary | null | undefined,
  moduleId: SidebarModuleId,
): number {
  if (!summary) return 0;
  const ids = SIDEBAR_MODULE_NOTIFICATION_IDS[moduleId];
  if (!ids?.length) return 0;

  return summary.modules
    .filter((mod) => ids.includes(mod.id))
    .reduce((sum, mod) => sum + mod.count, 0);
}
