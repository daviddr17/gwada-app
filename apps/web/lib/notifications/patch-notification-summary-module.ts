import type { NotificationModuleId } from "@/lib/notifications/notification-modules";
import type { NotificationSummary } from "@/lib/notifications/notification-types";

/** Glocke: Modul sofort aus dem Cache entfernen (z. B. nach „alle gelesen“). */
export function patchNotificationSummaryClearModule(
  summary: NotificationSummary,
  moduleId: NotificationModuleId,
): NotificationSummary {
  const modules = summary.modules.filter((mod) => mod.id !== moduleId);
  const totalCount = modules.reduce((sum, mod) => sum + mod.count, 0);
  return { ...summary, modules, totalCount };
}
