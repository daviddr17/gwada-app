import "server-only";

import { formatDiningTableLabel } from "@gwada/shared";
import {
  buildReservationCalendarIcs,
  reservationCalendarContentType,
  reservationCalendarFilename,
  reservationCalendarFingerprint,
  resolveReservationCalendarTimeZone,
  type ReservationCalendarFacts,
} from "@/lib/reservations/reservation-calendar-ics";
import {
  RESERVATION_DINING_TABLE_EMBED,
  RESERVATION_STATUS_EMBED,
} from "@/lib/supabase/reservations-db";
import { fetchRestaurantTimezoneServer } from "@/lib/supabase/restaurant-timezone-server";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ReservationCalendarFile = {
  filename: string;
  content: string;
  contentType: string;
  sequence: number;
  fingerprint: string;
};

function joinAddress(parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean)
    .join(", ");
}

async function claimSequence(
  sb: SupabaseClient,
  reservationId: string,
  fingerprint: string,
): Promise<number> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await sb
      .from("reservations")
      .select("calendar_sequence, calendar_fingerprint")
      .eq("id", reservationId)
      .maybeSingle();
    if (error || !data) {
      throw new Error(error?.message ?? "calendar_row_missing");
    }
    const storedFp =
      typeof data.calendar_fingerprint === "string"
        ? data.calendar_fingerprint
        : null;
    const storedSeq = Number(data.calendar_sequence ?? 0);
    if (storedFp === fingerprint) {
      return Number.isFinite(storedSeq) ? storedSeq : 0;
    }
    const nextSeq = storedFp == null ? 0 : (Number.isFinite(storedSeq) ? storedSeq : 0) + 1;
    let update = sb
      .from("reservations")
      .update({
        calendar_sequence: nextSeq,
        calendar_fingerprint: fingerprint,
      })
      .eq("id", reservationId);
    update =
      storedFp == null
        ? update.is("calendar_fingerprint", null)
        : update.eq("calendar_fingerprint", storedFp);
    const { data: written, error: writeError } = await update
      .select("calendar_sequence")
      .maybeSingle();
    if (writeError) throw new Error(writeError.message);
    if (written) return Number(written.calendar_sequence ?? nextSeq);
  }
  throw new Error("calendar_sequence_conflict");
}

export async function loadReservationCalendarFile(
  sb: SupabaseClient,
  reservationId: string,
): Promise<ReservationCalendarFile | null> {
  try {
    const { data, error } = await sb
      .from("reservations")
      .select(
        `
        id,
        restaurant_id,
        reservation_number,
        guest_first_name,
        guest_last_name,
        guest_email,
        party_size,
        starts_at,
        ends_at,
        dining_table_id,
        ${RESERVATION_STATUS_EMBED} ( code ),
        ${RESERVATION_DINING_TABLE_EMBED} ( table_number, table_name )
      `,
      )
      .eq("id", reservationId)
      .maybeSingle();
    if (error || !data) return null;

    const statusRaw = data.reservation_statuses as
      | { code: string }
      | { code: string }[]
      | null;
    const status = Array.isArray(statusRaw) ? statusRaw[0] : statusRaw;
    if (status?.code !== "confirmed") return null;

    const { data: restaurant } = await sb
      .from("restaurants")
      .select(
        "name, email, address_line1, address_line2, postal_code, city, country, timezone",
      )
      .eq("id", data.restaurant_id as string)
      .maybeSingle();

    const tableRaw = data.dining_tables as
      | { table_number: number; table_name: string | null }
      | { table_number: number; table_name: string | null }[]
      | null;
    const table = Array.isArray(tableRaw) ? tableRaw[0] : tableRaw;
    const tableLabel = table
      ? formatDiningTableLabel({
          table_number: Number(table.table_number),
          table_name: table.table_name,
        })
      : "";
    const cityLine = [
      typeof restaurant?.postal_code === "string" ? restaurant.postal_code.trim() : "",
      typeof restaurant?.city === "string" ? restaurant.city.trim() : "",
    ]
      .filter(Boolean)
      .join(" ");
    const address = joinAddress([
      restaurant?.address_line1 as string | null,
      restaurant?.address_line2 as string | null,
      cityLine,
      restaurant?.country as string | null,
    ]);
    const location = [address, tableLabel].filter(Boolean).join(", ");
    const timeZone =
      (typeof restaurant?.timezone === "string" && restaurant.timezone.trim()) ||
      (await fetchRestaurantTimezoneServer(sb, data.restaurant_id as string));
    const facts: ReservationCalendarFacts = {
      startsAt: String(data.starts_at),
      endsAt: String(data.ends_at),
      partySize: Number(data.party_size),
      diningTableId: (data.dining_table_id as string | null) ?? null,
      location,
    };
    const fingerprint = reservationCalendarFingerprint(facts);
    const sequence = await claimSequence(sb, reservationId, fingerprint);
    const content = buildReservationCalendarIcs({
      reservationId,
      reservationNumber: Number(data.reservation_number),
      sequence,
      timeZone: resolveReservationCalendarTimeZone(timeZone),
      startsAt: new Date(String(data.starts_at)),
      endsAt: new Date(String(data.ends_at)),
      partySize: Number(data.party_size),
      guestFirstName: String(data.guest_first_name ?? ""),
      guestLastName: String(data.guest_last_name ?? ""),
      guestEmail: (data.guest_email as string | null) ?? null,
      restaurantName:
        typeof restaurant?.name === "string" ? restaurant.name : "",
      restaurantEmail:
        typeof restaurant?.email === "string" ? restaurant.email : null,
      location,
    });
    return {
      filename: reservationCalendarFilename(Number(data.reservation_number)),
      content,
      contentType: reservationCalendarContentType(),
      sequence,
      fingerprint,
    };
  } catch (e) {
    console.warn("[reservation-calendar] build", e);
    return null;
  }
}

/** Gewinnt den Versand einer Aktualisierung, wenn der Termin sich seit der letzten Mail geändert hat. */
export async function claimReservationCalendarEmailUpdate(
  sb: SupabaseClient,
  reservationId: string,
  fingerprint: string,
): Promise<{ send: boolean; previous: string | null }> {
  const { data, error } = await sb
    .from("reservations")
    .select("calendar_emailed_fingerprint")
    .eq("id", reservationId)
    .maybeSingle();
  if (error || !data) return { send: false, previous: null };
  const previous =
    typeof data.calendar_emailed_fingerprint === "string"
      ? data.calendar_emailed_fingerprint
      : null;
  if (previous === fingerprint) return { send: false, previous };
  let update = sb
    .from("reservations")
    .update({ calendar_emailed_fingerprint: fingerprint })
    .eq("id", reservationId);
  update =
    previous == null
      ? update.is("calendar_emailed_fingerprint", null)
      : update.eq("calendar_emailed_fingerprint", previous);
  const { data: written, error: writeError } = await update
    .select("id")
    .maybeSingle();
  if (writeError || !written) return { send: false, previous };
  return { send: true, previous };
}

export async function restoreReservationCalendarEmailedFingerprint(
  sb: SupabaseClient,
  reservationId: string,
  currentFingerprint: string,
  previous: string | null,
): Promise<void> {
  await sb
    .from("reservations")
    .update({ calendar_emailed_fingerprint: previous })
    .eq("id", reservationId)
    .eq("calendar_emailed_fingerprint", currentFingerprint);
}

export async function rememberReservationCalendarEmailed(
  sb: SupabaseClient,
  reservationId: string,
  fingerprint: string,
): Promise<void> {
  await sb
    .from("reservations")
    .update({ calendar_emailed_fingerprint: fingerprint })
    .eq("id", reservationId);
}
