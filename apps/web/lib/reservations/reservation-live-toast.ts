import { toast } from "sonner";

export type ReservationLiveToastFields = {
  starts_at: string;
  guest_first_name: string | null;
  guest_last_name: string | null;
  party_size: number;
};

/** z. B. `04.06.2026, 19:30 · Mustermann, Max | 4 Pers.` */
export function formatReservationLiveToastDescription(
  row: ReservationLiveToastFields,
): string {
  const d = new Date(row.starts_at);
  const date = d.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const time = d.toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });
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

export function showNewReservationToast(row: ReservationLiveToastFields | null) {
  toast.info("Neue Reservierung", {
    description: row
      ? formatReservationLiveToastDescription(row)
      : "Wird aktualisiert …",
    duration: 4_000,
  });
}
