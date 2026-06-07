export type ReservationPendingChange = {
  guest_first_name: string;
  guest_last_name: string;
  guest_phone: string | null;
  guest_email: string | null;
  party_size: number;
  starts_at: string;
  ends_at: string;
  dwell_minutes: number | null;
  notify_email: boolean;
  notify_whatsapp: boolean;
  terms_accepted: boolean;
  requested_at: string;
};

export function parseReservationPendingChange(
  raw: unknown,
): ReservationPendingChange | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (
    typeof o.guest_last_name !== "string" ||
    typeof o.starts_at !== "string" ||
    typeof o.ends_at !== "string" ||
    typeof o.party_size !== "number"
  ) {
    return null;
  }
  return {
    guest_first_name:
      typeof o.guest_first_name === "string" ? o.guest_first_name : "Gast",
    guest_last_name: o.guest_last_name,
    guest_phone:
      o.guest_phone == null ? null : String(o.guest_phone).trim() || null,
    guest_email:
      o.guest_email == null ? null : String(o.guest_email).trim() || null,
    party_size: o.party_size,
    starts_at: o.starts_at,
    ends_at: o.ends_at,
    dwell_minutes:
      typeof o.dwell_minutes === "number" ? o.dwell_minutes : null,
    notify_email: Boolean(o.notify_email),
    notify_whatsapp: Boolean(o.notify_whatsapp),
    terms_accepted: Boolean(o.terms_accepted),
    requested_at:
      typeof o.requested_at === "string"
        ? o.requested_at
        : new Date().toISOString(),
  };
}

const timeDe = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatReservationSlotDe(iso: string): string {
  return timeDe.format(new Date(iso));
}

export type ReservationChangeFieldKey =
  | "guest"
  | "party_size"
  | "starts_at"
  | "guest_phone"
  | "guest_email";

export function reservationChangeDiffKeys(
  current: {
    guest_first_name: string;
    guest_last_name: string;
    party_size: number;
    starts_at: string;
    ends_at: string;
    guest_phone: string | null;
    guest_email: string | null;
  },
  pending: ReservationPendingChange,
): ReservationChangeFieldKey[] {
  const keys: ReservationChangeFieldKey[] = [];
  const guestCur =
    `${current.guest_first_name} ${current.guest_last_name}`.trim();
  const guestNew =
    `${pending.guest_first_name} ${pending.guest_last_name}`.trim();
  if (guestCur !== guestNew) keys.push("guest");
  if (current.party_size !== pending.party_size) keys.push("party_size");
  if (
    current.starts_at !== pending.starts_at ||
    current.ends_at !== pending.ends_at
  ) {
    keys.push("starts_at");
  }
  if ((current.guest_phone ?? "") !== (pending.guest_phone ?? "")) {
    keys.push("guest_phone");
  }
  if ((current.guest_email ?? "") !== (pending.guest_email ?? "")) {
    keys.push("guest_email");
  }
  return keys;
}
