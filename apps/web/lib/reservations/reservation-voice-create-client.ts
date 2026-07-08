"use client";

import {
  datetimeLocalValueToIso,
  ymdAndHmToDatetimeLocal,
} from "@/lib/reservations/datetime-local";
import type { ParsedReservationVoice } from "@/lib/reservations/parse-reservation-voice-text";
import { dispatchDashboardReservationCreateLivePatch } from "@/lib/dashboard/dispatch-dashboard-reservation-save-live-client";
import { logReservationCreateFromBrowser } from "@/lib/reservations/reservation-log-client";
import {
  triggerReservationEmailDispatch,
  emailDispatchUserMessage,
} from "@/lib/reservations/trigger-email-dispatch";
import {
  triggerReservationWhatsappDispatch,
  whatsappDispatchUserMessage,
} from "@/lib/reservations/trigger-whatsapp-dispatch";
import {
  fetchReservationStatuses,
  insertReservation,
  defaultStaffReservationStatusId,
  type ReservationStatusJoin,
} from "@/lib/supabase/reservations-db";

export async function createReservationFromVoiceParsed(params: {
  restaurantId: string;
  parsed: ParsedReservationVoice;
  defaultDwellMinutes: number;
  statuses?: ReservationStatusJoin[];
  isSuperadmin?: boolean;
}): Promise<{ ok: true; reservationNumber: number } | { ok: false; error: string }> {
  let statuses = params.statuses;
  if (!statuses?.length) {
    const loaded = await fetchReservationStatuses();
    if (loaded.error) {
      return { ok: false, error: loaded.error.message };
    }
    statuses = loaded.data;
  }

  const statusId = defaultStaffReservationStatusId(statuses);
  if (!statusId) {
    return { ok: false, error: "Kein Reservierungsstatus verfügbar." };
  }

  const startsLocal = ymdAndHmToDatetimeLocal(
    params.parsed.dateYmd,
    params.parsed.timeHm,
  );
  const startsIso = datetimeLocalValueToIso(startsLocal);
  const dwell = params.defaultDwellMinutes;
  const endsIso = new Date(
    new Date(startsIso).getTime() + dwell * 60 * 1000,
  ).toISOString();

  const payload = {
    guest_first_name: params.parsed.guestFirstName.trim() || "Gast",
    guest_last_name: params.parsed.guestLastName.trim(),
    guest_phone: null,
    guest_email: null,
    party_size: params.parsed.partySize,
    starts_at: startsIso,
    ends_at: endsIso,
    status_id: statusId,
    dining_table_id: null,
    dwell_minutes: dwell,
    notify_email: true,
    notify_whatsapp: false,
    terms_accepted: true,
    notes: null,
  };

  const { data: created, error } = await insertReservation({
    restaurant_id: params.restaurantId,
    ...payload,
  });

  if (error) return { ok: false, error: error.message };
  if (!created) return { ok: false, error: "Reservierung konnte nicht angelegt werden." };

  void logReservationCreateFromBrowser({
    restaurantId: params.restaurantId,
    reservationId: created.id,
    reservationNumber: created.reservation_number,
    guestFirstName: payload.guest_first_name,
    guestLastName: payload.guest_last_name,
    payload,
    statuses,
    tables: [],
  });

  if (payload.notify_whatsapp) {
    void triggerReservationWhatsappDispatch(created.id, "created").then((wa) => {
      const msg = whatsappDispatchUserMessage(wa);
      if (msg) console.warn("[voice-reservation]", msg);
    });
  }
  if (payload.notify_email) {
    void triggerReservationEmailDispatch(created.id, "created").then((em) => {
      const msg = emailDispatchUserMessage(em, {
        isSuperadmin: params.isSuperadmin ?? false,
      });
      if (msg) console.warn("[voice-reservation]", msg);
    });
  }

  const status = statuses.find((s) => s.id === statusId);
  dispatchDashboardReservationCreateLivePatch({
    restaurantId: params.restaurantId,
    insert: {
      id: created.id,
      starts_at: payload.starts_at,
      ends_at: payload.ends_at,
      dwell_minutes: payload.dwell_minutes,
      guest_first_name: payload.guest_first_name,
      guest_last_name: payload.guest_last_name,
      party_size: payload.party_size,
      statusId,
      statusCode: status?.code ?? "confirmed",
      statusName: status?.name ?? "Bestätigt",
      statusColorHex: status?.color_hex,
    },
  });

  return { ok: true, reservationNumber: created.reservation_number };
}
