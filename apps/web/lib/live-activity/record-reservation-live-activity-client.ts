"use client";

import { liveActivityFromNotificationEvent } from "@/lib/live-activity/live-activity-from-notification-event";
import {
  isPureCancellationStatusChange,
  reservationLogLiveActivityStaffName,
  reservationLogLiveActivitySummary,
  shouldEmitReservationLogLiveActivity,
} from "@/lib/live-activity/reservation-log-live-activity";
import { recordLiveActivity } from "@/lib/live-activity/live-activity-store";
import type {
  ReservationLogAction,
  ReservationLogDetails,
} from "@/lib/types/reservation-log";

export {
  isPureCancellationStatusChange,
  shouldEmitReservationLogLiveActivity,
} from "@/lib/live-activity/reservation-log-live-activity";

/** Sofortiger Live-Verlauf nach Staff-Log (Bestätigen, Ändern, Freigeben, …). */
export function recordReservationLogLiveActivity(params: {
  restaurantId: string;
  logEntryId: string;
  reservationId: string | null;
  reservationNumber: number | null;
  guestLabel: string;
  action: ReservationLogAction;
  details?: ReservationLogDetails | null;
  createdAt?: string;
}): void {
  if (!shouldEmitReservationLogLiveActivity(params)) return;

  const details = params.details ?? {};
  const changes = details.changes ?? [];
  const staffName = reservationLogLiveActivityStaffName(details);
  const summary = reservationLogLiveActivitySummary(details);

  const mapped = liveActivityFromNotificationEvent({
    referenceId: params.logEntryId,
    module: "reservations_activity",
    payload: {
      logEntryId: params.logEntryId,
      reservationId: params.reservationId,
      reservationNumber: params.reservationNumber,
      guestLabel: params.guestLabel,
      action: params.action,
      actorSource: details.actorSource ?? "staff",
      staffName,
      summary,
      changes,
      at: params.createdAt ?? new Date().toISOString(),
    },
    createdAt: params.createdAt,
  });

  recordLiveActivity(params.restaurantId, {
    ...mapped,
    id: mapped.id ?? `log:${params.logEntryId}`,
  });
}

/** Storno: Feed-Modul `reservations_cancellation` (Log-Trigger überspringt das). */
export function recordReservationCancellationLiveActivity(params: {
  restaurantId: string;
  reservationId: string;
  guestLabel: string;
  reservationNumber?: number | null;
  partySize?: number | null;
  startsAt?: string | null;
}): void {
  const referenceId = `${params.reservationId}:reservations_cancellation`;
  const mapped = liveActivityFromNotificationEvent({
    referenceId,
    module: "reservations_cancellation",
    payload: {
      guestLabel: params.guestLabel,
      partySize: params.partySize ?? undefined,
      startsAt: params.startsAt ?? undefined,
      reservationNumber: params.reservationNumber ?? undefined,
      reservationId: params.reservationId,
    },
  });
  recordLiveActivity(params.restaurantId, {
    ...mapped,
    id: mapped.id ?? `ref:${referenceId}`,
  });
}
