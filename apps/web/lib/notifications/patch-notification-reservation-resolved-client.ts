import type { NotificationModuleId } from "@/lib/notifications/notification-modules";
import type { NotificationSummary } from "@/lib/notifications/notification-types";
import {
  isOpenReservationStatusCode,
  shouldDecrementUnconfirmedCount,
} from "@/lib/reservations/reservation-open-status";

export function notificationModuleForOpenReservationStatus(
  code: string,
): NotificationModuleId | null {
  if (code === "pending") return "reservations_pending";
  if (code === "change_requested") return "reservations_change_request";
  return null;
}

/** Glocke: Reservierung aus pending/change_request-Modul entfernen. */
export function patchNotificationSummaryRemoveReservation(
  summary: NotificationSummary,
  params: {
    reservationId: string;
    previousStatusCode: string;
    nextStatusCode: string;
  },
): NotificationSummary {
  const moduleId = notificationModuleForOpenReservationStatus(
    params.previousStatusCode,
  );
  if (!moduleId || !isOpenReservationStatusCode(params.previousStatusCode)) {
    return summary;
  }

  const modules = summary.modules
    .map((mod) => {
      if (mod.id !== moduleId) return mod;
      const items = mod.items.filter((i) => i.id !== params.reservationId);
      const removed = mod.items.length - items.length;
      if (removed === 0) return mod;
      return {
        ...mod,
        items,
        count: Math.max(0, mod.count - removed),
      };
    })
    .filter((mod) => mod.count > 0);

  const totalCount = modules.reduce((sum, m) => sum + m.count, 0);
  return { ...summary, modules, totalCount };
}

export function shouldPatchNotificationForReservationResolve(
  previousStatusCode: string,
): boolean {
  return notificationModuleForOpenReservationStatus(previousStatusCode) != null;
}

export { shouldDecrementUnconfirmedCount };
