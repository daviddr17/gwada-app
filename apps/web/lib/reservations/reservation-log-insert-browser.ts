"use client";

import type {
  ReservationLogAction,
  ReservationLogDetails,
} from "@/lib/types/reservation-log";
import {
  recordReservationCancellationLiveActivity,
  recordReservationLogLiveActivity,
} from "@/lib/live-activity/record-reservation-live-activity-client";
import {
  isPureCancellationStatusChange,
  shouldEmitReservationLogLiveActivity,
} from "@/lib/live-activity/reservation-log-live-activity";
import { insertReservationLogEntry } from "@/lib/reservations/reservation-log-insert";
import { resolveReservationLogActorNames } from "@/lib/reservations/reservation-log-actor-resolve";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

/** Browser: Log schreiben + Live-Verlauf sofort (ohne Realtime/Poll). */
export async function insertReservationLogFromBrowser(params: {
  restaurantId: string;
  reservationId: string | null;
  action: ReservationLogAction;
  reservationNumber: number | null;
  guestLabel: string;
  details?: ReservationLogDetails;
}): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let details = params.details ?? { actorSource: "staff" as const };
  if (user && details.actorSource !== "guest" && details.actorSource !== "display") {
    const hasName = Boolean(
      details.actorGivenName?.trim() || details.actorFamilyName?.trim(),
    );
    if (!hasName) {
      const actor = await resolveReservationLogActorNames(supabase, {
        restaurantId: params.restaurantId,
        actorUserId: user.id,
      });
      if (actor) {
        details = {
          ...details,
          actorGivenName: actor.actorGivenName,
          actorFamilyName: actor.actorFamilyName,
          actorSource: details.actorSource ?? "staff",
        };
      }
    } else {
      details = {
        ...details,
        actorSource: details.actorSource ?? "staff",
      };
    }
  }

  const { id: logId, createdAt } = await insertReservationLogEntry(supabase, {
    ...params,
    actorUserId: user?.id ?? null,
    details,
  });

  if (!logId) return;

  if (shouldEmitReservationLogLiveActivity({ action: params.action, details })) {
    recordReservationLogLiveActivity({
      restaurantId: params.restaurantId,
      logEntryId: logId,
      reservationId: params.reservationId,
      reservationNumber: params.reservationNumber,
      guestLabel: params.guestLabel.trim(),
      action: params.action,
      details,
      createdAt: createdAt ?? undefined,
    });
    return;
  }

  if (
    params.action === "updated" &&
    params.reservationId &&
    isPureCancellationStatusChange(details)
  ) {
    recordReservationCancellationLiveActivity({
      restaurantId: params.restaurantId,
      reservationId: params.reservationId,
      guestLabel: params.guestLabel.trim(),
      reservationNumber: params.reservationNumber,
    });
  }
}
