"use client";

import type { DisplayReservationRow } from "@/lib/display/display-reservations-server";
import { displayReservationSaveErrorMessage } from "@/lib/display/display-reservation-save-errors";
import { buildDisplayReservationSlotIso } from "@/lib/display/display-reservation-save-times";
import {
  normalizeBookingTimeStepMinutes,
  type BookingTimeStepMinutes,
} from "@/lib/reservations/booking-time-step";
import {
  normalizeReservationGuestFirstName,
  normalizeReservationGuestLastName,
} from "@/lib/reservations/reservation-guest-name";
import type { ParsedReservationVoice } from "@/lib/reservations/parse-reservation-voice-text";
import {
  defaultStaffReservationStatusId,
  type ReservationStatusJoin,
} from "@/lib/supabase/reservations-db";

export async function createDisplayReservationFromVoiceParsed(params: {
  parsed: ParsedReservationVoice;
  defaultDwellMinutes: number;
  bookingTimeStepMinutes: BookingTimeStepMinutes | number;
  timeZone: string;
  statuses: ReservationStatusJoin[];
}): Promise<
  | {
      ok: true;
      reservationNumber: number;
      reservation: DisplayReservationRow | null;
    }
  | { ok: false; error: string }
> {
  const statusId = defaultStaffReservationStatusId(params.statuses);
  if (!statusId) {
    return { ok: false, error: "Kein Reservierungsstatus verfügbar." };
  }

  const step = normalizeBookingTimeStepMinutes(params.bookingTimeStepMinutes);
  const dwell =
    Number.isFinite(params.defaultDwellMinutes) &&
    params.defaultDwellMinutes >= 15
      ? params.defaultDwellMinutes
      : 120;

  const slot = buildDisplayReservationSlotIso(
    params.parsed.dateYmd,
    params.parsed.timeHm,
    dwell,
    params.timeZone,
    step,
  );
  if (!slot) {
    return { ok: false, error: "Ungültiges Datum oder Uhrzeit." };
  }

  const res = await fetch("/api/display/reservations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      guest_first_name: normalizeReservationGuestFirstName(params.parsed.guestFirstName),
      guest_last_name: normalizeReservationGuestLastName(params.parsed.guestLastName),
      guest_phone: null,
      guest_email: null,
      party_size: params.parsed.partySize,
      starts_at: slot.startsIso,
      ends_at: slot.endsIso,
      status_id: statusId,
      dining_table_id: null,
      dwell_minutes: dwell,
      notify_email: true,
      notify_whatsapp: false,
      terms_accepted: true,
      notes: null,
    }),
  });

  const data = (await res.json()) as {
    error?: string;
    reservation_number?: number;
    reservation?: DisplayReservationRow;
  };

  if (!res.ok) {
    return { ok: false, error: displayReservationSaveErrorMessage(data.error) };
  }

  return {
    ok: true,
    reservationNumber: data.reservation_number ?? 0,
    reservation: data.reservation ?? null,
  };
}
