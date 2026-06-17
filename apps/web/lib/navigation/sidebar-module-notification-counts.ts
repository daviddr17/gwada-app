import type { SidebarModuleId } from "@/lib/constants/sidebar-modules";
import type { NotificationModuleId } from "@/lib/notifications/notification-modules";
import type { NotificationSummary } from "@/lib/notifications/notification-types";

const SIDEBAR_MODULE_NOTIFICATION_IDS: Partial<
  Record<SidebarModuleId, readonly NotificationModuleId[]>
> = {
  reservierungen: ["reservations_pending"],
  kontakte: ["messages"],
  bewertungen: ["reviews"],
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
