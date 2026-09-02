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
