"use client";

import { dispatchDashboardReservationUpdateLivePatch } from "@/lib/dashboard/dispatch-dashboard-reservation-save-live-client";
import {
  logReservationMutationFromBrowser,
  reservationSnapshotFromListRow,
} from "@/lib/reservations/reservation-log-client";
import {
  dispatchReservationGuestNotificationsInBackground,
} from "@/lib/reservations/reservation-guest-notify-dispatch-client";
import { reservationStatusDispatchEvent } from "@/lib/reservations/reservation-status-dispatch-event";
import { dispatchReservationOpenResolvedLivePatch } from "@/lib/reservations/reservation-open-status";
import {
  fetchReservationById,
  fetchReservationStatuses,
  updateReservationStatus,
} from "@/lib/supabase/reservations-db";
import { formatReservationGuestLabel } from "@/lib/types/reservation-log";
import { recordReservationLogLiveActivity } from "@/lib/live-activity/record-reservation-live-activity-client";

export type ConfirmPendingReservationResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * pending → confirmed inkl. Gast-Benachrichtigungen (E-Mail/WhatsApp wie gespeichert).
 * change_requested bewusst nicht — dafür Edit-Drawer / Änderungsfreigabe.
 */
export async function confirmPendingReservationFromBrowser(params: {
  restaurantId: string;
  reservationId: string;
  isSuperadmin?: boolean;
}): Promise<ConfirmPendingReservationResult> {
  const { data: row, error: fetchError } = await fetchReservationById({
    restaurantId: params.restaurantId,
    id: params.reservationId,
  });
  if (fetchError) {
    return { ok: false, error: fetchError.message };
  }
  if (!row) {
    return { ok: false, error: "Reservierung nicht gefunden." };
  }

  const previousStatusCode = row.reservation_statuses?.code ?? "";
  if (previousStatusCode !== "pending") {
    return {
      ok: false,
      error:
        previousStatusCode === "change_requested"
          ? "Änderungswunsch bitte im Detail freigeben."
          : "Nur unbestätigte Reservierungen können so bestätigt werden.",
    };
  }

  const { data: statuses, error: statusError } =
    await fetchReservationStatuses();
  if (statusError) {
    return { ok: false, error: statusError.message };
  }
  const confirmed = statuses.find((s) => s.code === "confirmed");
  if (!confirmed?.id) {
    return { ok: false, error: "Status „Bestätigt“ fehlt." };
  }

  const { error: updateError } = await updateReservationStatus(
    row.id,
    confirmed.id,
    row.updated_at,
  );
  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  const before = reservationSnapshotFromListRow(row, statuses, []);
  const after = {
    ...before,
    status_id: confirmed.id,
    status_name: confirmed.name,
  };
  const previousStatusName = row.reservation_statuses?.name ?? "Ausstehend";
  const guestLabel = formatReservationGuestLabel(
    row.reservation_number,
    row.guest_first_name,
    row.guest_last_name,
    row.guest_company,
  );
  const statusSummary = `Status: „${previousStatusName}“ → „${confirmed.name}“`;

  // Sofort in den Live-Verlauf — nicht auf Log/Realtime/60s-Poll warten
  // (Live: kein Browser-WebSocket über /sb-Proxy).
  recordReservationLogLiveActivity({
    restaurantId: row.restaurant_id,
    logEntryId: `local-confirm:${row.id}`,
    reservationId: row.id,
    reservationNumber: row.reservation_number,
    guestLabel,
    action: "updated",
    details: {
      actorSource: "staff",
      changes: [
        {
          field: "status",
          label: "Status",
          from: previousStatusName,
          to: confirmed.name,
        },
      ],
      summary: statusSummary,
    },
  });

  void logReservationMutationFromBrowser({
    restaurantId: row.restaurant_id,
    reservationId: row.id,
    reservationNumber: row.reservation_number,
    guestFirstName: row.guest_first_name,
    guestLastName: row.guest_last_name,
    guestCompany: row.guest_company,
    action: "updated",
    before,
    after,
  });

  dispatchReservationOpenResolvedLivePatch({
    restaurantId: row.restaurant_id,
    reservationId: row.id,
    previousStatusCode,
    nextStatusCode: "confirmed",
    nextStatus: {
      id: confirmed.id,
      name: confirmed.name,
      color_hex: confirmed.color_hex,
    },
  });
  dispatchDashboardReservationUpdateLivePatch(row.restaurant_id);

  const dispatchEvent = reservationStatusDispatchEvent(
    previousStatusCode,
    "confirmed",
  );

  if (dispatchEvent) {
    dispatchReservationGuestNotificationsInBackground({
      reservationId: row.id,
      dispatchEvent,
      notifyWhatsapp: row.notify_whatsapp === true,
      notifyEmail: row.notify_email === true,
      isSuperadmin: params.isSuperadmin,
    });
  }

  return { ok: true };
}
