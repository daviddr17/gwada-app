import type { ReservationStatusJoin } from "@/lib/supabase/reservations-db";

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

export function reservationStatusStripeHex(
  status: Pick<ReservationStatusJoin, "color_hex"> | null | undefined,
): string {
  const hex = status?.color_hex?.trim();
  return hex && HEX_RE.test(hex) ? hex : "#64748b";
}
