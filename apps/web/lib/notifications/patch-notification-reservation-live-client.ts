import type { NotificationModuleId } from "@/lib/notifications/notification-modules";
import { NOTIFICATION_MODULES } from "@/lib/notifications/notification-modules";
import type {
  NotificationItem,
  NotificationSummary,
} from "@/lib/notifications/notification-types";

const RESERVATION_LIVE_MODULES = new Set<NotificationModuleId>([
  "reservations_pending",
  "reservations_change_request",
  "reservations_cancellation",
]);

export function isReservationNotificationModule(
  module: string,
): module is NotificationModuleId {
  return RESERVATION_LIVE_MODULES.has(module as NotificationModuleId);
}

/** Glocke: notification_events-INSERT ohne API-Refetch. */
export function patchNotificationSummaryFromReservationEvent(
  summary: NotificationSummary,
  params: {
    module: NotificationModuleId;
    referenceId: string;
    payload: Record<string, unknown>;
  },
): NotificationSummary {
  if (!RESERVATION_LIVE_MODULES.has(params.module)) return summary;

  const modDef = NOTIFICATION_MODULES[params.module];
  const guestLabel =
    (typeof params.payload.guestLabel === "string"
      ? params.payload.guestLabel.trim()
      : "") || "Gast";
  const partySize =
    typeof params.payload.partySize === "number"
      ? params.payload.partySize
      : 1;
  const startsAt =
    typeof params.payload.startsAt === "string"
      ? params.payload.startsAt
      : new Date().toISOString();
  const reservationNumber =
    typeof params.payload.reservationNumber === "number"
      ? params.payload.reservationNumber
      : null;

  const subtitleParts = [
    reservationNumber != null ? `#${reservationNumber}` : null,
    `${partySize} Pers.`,
  ].filter(Boolean);

  const newItem: NotificationItem = {
    id: params.referenceId,
    title: guestLabel,
    subtitle: subtitleParts.join(" · ") || modDef.label,
    href: `/dashboard/reservierungen/uebersicht?reservation=${encodeURIComponent(params.referenceId)}`,
    at: startsAt,
    meta: { reservationId: params.referenceId },
  };

  const existing = summary.modules.find((m) => m.id === params.module);
  const otherModules = summary.modules.filter((m) => m.id !== params.module);
  const items = [
    newItem,
    ...(existing?.items.filter((i) => i.id !== params.referenceId) ?? []),
  ].slice(0, 5);

  const count = (existing?.count ?? 0) + 1;
  const nextModule = {
    id: params.module,
    count,
    label: existing?.label ?? modDef.labelPlural,
    href: existing?.href ?? modDef.href,
    items,
  };

  const modules = [...otherModules, nextModule];
  return {
    ...summary,
    modules,
    totalCount: modules.reduce((sum, m) => sum + m.count, 0),
  };
}
