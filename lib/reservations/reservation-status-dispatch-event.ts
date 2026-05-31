import type { DispatchEvent } from "@/lib/reservations/reservation-email-dispatch";

/** Sofortnachricht auslösen, wenn sich der Reservierungsstatus geändert hat. */
export function reservationStatusDispatchEvent(
  previousCode: string | null,
  newCode: string,
): DispatchEvent | null {
  if (!newCode || newCode === previousCode) return null;
  if (newCode === "confirmed" && previousCode !== "confirmed") return "confirmed";
  if (newCode === "cancelled" && previousCode !== "cancelled") return "cancelled";
  if (newCode === "declined" && previousCode !== "declined") return "declined";
  if (newCode === "no_show" && previousCode !== "no_show") return "no_show";
  return null;
}
