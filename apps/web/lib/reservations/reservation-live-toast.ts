import { toast } from "sonner";

import {
  DEFAULT_RESTAURANT_TIMEZONE,
  formatReservationDateInRestaurantTz,
  formatReservationTimeInRestaurantTz,
} from "@/lib/restaurant/restaurant-timezone";

export type ReservationLiveToastFields = {
  starts_at: string;
  guest_first_name: string | null;
  guest_last_name: string | null;
  party_size: number;
};

/** z. B. `04.06.2026, 19:30 · Mustermann, Max | 4 Pers.` */
export function formatReservationLiveToastDescription(
  row: ReservationLiveToastFields,
  timeZone: string = DEFAULT_RESTAURANT_TIMEZONE,
): string {
  const date = formatReservationDateInRestaurantTz(row.starts_at, timeZone);
  const time = formatReservationTimeInRestaurantTz(row.starts_at, timeZone);
  const family = row.guest_last_name?.trim() || "—";
  const given = row.guest_first_name?.trim() || "—";
  const pers = row.party_size;
  return `${date}, ${time} · ${family}, ${given} | ${pers} Pers.`;
}

export function reservationLiveToastFromRecord(
  row: Record<string, unknown>,
): ReservationLiveToastFields | null {
  const startsAt = row.starts_at;
  if (typeof startsAt !== "string") return null;
  const partyRaw = row.party_size;
  const partySize =
    typeof partyRaw === "number"
      ? partyRaw
      : typeof partyRaw === "string"
        ? Number.parseInt(partyRaw, 10)
        : 0;
  return {
    starts_at: startsAt,
    guest_first_name:
      typeof row.guest_first_name === "string" ? row.guest_first_name : null,
    guest_last_name:
      typeof row.guest_last_name === "string" ? row.guest_last_name : null,
    party_size: Number.isFinite(partySize) && partySize > 0 ? partySize : 1,
  };
}

export function showNewReservationToast(
  row: ReservationLiveToastFields | null,
  timeZone: string = DEFAULT_RESTAURANT_TIMEZONE,
) {
  toast.info("Neue Reservierung", {
    description: row
      ? formatReservationLiveToastDescription(row, timeZone)
      : "Wird aktualisiert …",
    duration: 4_000,
  });
}
