"use client";

import { dispatchDashboardReservationUpdateLivePatch } from "@/lib/dashboard/dispatch-dashboard-reservation-save-live-client";
import {
  logReservationMutationFromBrowser,
  reservationSnapshotFromListRow,
} from "@/lib/reservations/reservation-log-client";
import { reservationStatusDispatchEvent } from "@/lib/reservations/reservation-status-dispatch-event";
import { dispatchReservationOpenResolvedLivePatch } from "@/lib/reservations/reservation-open-status";
import {
  emailDispatchUserMessage,
  triggerReservationEmailDispatch,
} from "@/lib/reservations/trigger-email-dispatch";
import {
  triggerReservationWhatsappDispatch,
  whatsappDispatchUserMessage,
} from "@/lib/reservations/trigger-whatsapp-dispatch";
import {
  fetchReservationById,
  fetchReservationStatuses,
  updateReservationStatus,
} from "@/lib/supabase/reservations-db";

export type ConfirmPendingReservationResult =
  | { ok: true; warning?: string }
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
    action: "updated",
    before,
    after,
  });

  const dispatchEvent = reservationStatusDispatchEvent(
    previousStatusCode,
    "confirmed",
  );
  const warnings: string[] = [];
  if (dispatchEvent && row.notify_whatsapp) {
    const wa = await triggerReservationWhatsappDispatch(row.id, dispatchEvent);
    const msg = whatsappDispatchUserMessage(wa);
    if (msg) warnings.push(msg);
  }
  if (dispatchEvent && row.notify_email) {
    const em = await triggerReservationEmailDispatch(row.id, dispatchEvent);
    const msg = emailDispatchUserMessage(em, {
      isSuperadmin: params.isSuperadmin === true,
    });
    if (msg) warnings.push(msg);
  }

  dispatchReservationOpenResolvedLivePatch({
    restaurantId: row.restaurant_id,
    reservationId: row.id,
    previousStatusCode,
    nextStatusCode: "confirmed",
  });
  dispatchDashboardReservationUpdateLivePatch(row.restaurant_id);

  return warnings.length > 0
    ? { ok: true, warning: warnings.join(" ") }
    : { ok: true };
}
