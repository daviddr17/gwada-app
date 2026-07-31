import { fuzzyTextMatchesQuery } from "@/lib/utils/fuzzy-search";
import { reservationGuestDisplayName } from "@/lib/reservations/reservation-guest-name";

export type ReservationGuestSearchFields = {
  guest_first_name: string;
  guest_last_name: string;
  guest_company?: string | null;
  guest_phone?: string | null;
  guest_email?: string | null;
  reservation_number?: number | null;
};

/**
 * Namenssuche für Reservierungslisten: Teilstring + leichte Tippfehler
 * (`fuzzyTextMatchesQuery`, ab 3 Zeichen). Trifft auch Firma, Telefon, E-Mail, #Nummer.
 */
export function reservationMatchesGuestSearch(
  row: ReservationGuestSearchFields,
  query: string,
): boolean {
  const q = query.trim();
  if (!q) return true;

  const display = reservationGuestDisplayName(
    row.guest_first_name,
    row.guest_last_name,
    row.guest_company,
  );
  const lastFirst =
    `${row.guest_last_name} ${row.guest_first_name}`.trim();
  const company = row.guest_company?.trim() ?? "";
  const phone = row.guest_phone?.trim() ?? "";
  const email = row.guest_email?.trim() ?? "";
  const number =
    row.reservation_number != null && Number.isFinite(row.reservation_number)
      ? String(row.reservation_number)
      : "";

  const haystacks = [
    display,
    lastFirst,
    company,
    phone,
    email,
    number,
    number ? `#${number}` : "",
  ].filter((s) => s.length > 0);

  return haystacks.some((text) => fuzzyTextMatchesQuery(text, q));
}
