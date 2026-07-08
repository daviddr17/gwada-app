import { formatReservationSlotDe } from "@/lib/reservations/reservation-pending-change";
import type {
  ReservationLogChange,
  ReservationLogDetails,
} from "@/lib/types/reservation-log";
import type { ReservationUpdatePayload } from "@/lib/supabase/reservations-db";

export type ReservationLogSnapshot = {
  guest_first_name: string;
  guest_last_name: string;
  guest_phone: string | null;
  guest_email: string | null;
  party_size: number;
  starts_at: string;
  ends_at: string;
  status_id: string;
  status_name: string;
  dining_table_id: string | null;
  dining_table_label: string;
  dwell_minutes: number | null;
  notify_email: boolean;
  notify_whatsapp: boolean;
  terms_accepted: boolean;
  notes: string | null;
};

function guestName(s: ReservationLogSnapshot): string {
  return `${s.guest_first_name.trim()} ${s.guest_last_name.trim()}`.trim() || "Gast";
}

function boolDe(v: boolean): string {
  return v ? "Ja" : "Nein";
}

function strOrDash(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

function pushChange(
  changes: ReservationLogChange[],
  field: string,
  label: string,
  from: string | null,
  to: string | null,
) {
  if (from === to) return;
  changes.push({ field, label, from, to });
}

export function reservationSnapshotFromPayload(
  payload: ReservationUpdatePayload,
  statusName: string,
  diningTableLabel: string,
): ReservationLogSnapshot {
  return {
    guest_first_name: payload.guest_first_name,
    guest_last_name: payload.guest_last_name,
    guest_phone: payload.guest_phone,
    guest_email: payload.guest_email,
    party_size: payload.party_size,
    starts_at: payload.starts_at,
    ends_at: payload.ends_at,
    status_id: payload.status_id,
    status_name: statusName,
    dining_table_id: payload.dining_table_id,
    dining_table_label: diningTableLabel,
    dwell_minutes: payload.dwell_minutes,
    notify_email: payload.notify_email,
    notify_whatsapp: payload.notify_whatsapp,
    terms_accepted: payload.terms_accepted,
    notes: payload.notes ?? null,
  };
}

export function buildReservationLogChanges(
  before: ReservationLogSnapshot | null,
  after: ReservationLogSnapshot,
): ReservationLogChange[] {
  const changes: ReservationLogChange[] = [];

  if (!before) {
    pushChange(changes, "guest", "Gast", null, guestName(after));
    pushChange(changes, "party_size", "Personen", null, strOrDash(after.party_size));
    pushChange(
      changes,
      "starts_at",
      "Termin",
      null,
      formatReservationSlotDe(after.starts_at),
    );
    pushChange(changes, "status", "Status", null, after.status_name);
    pushChange(changes, "table", "Tisch", null, after.dining_table_label);
    return changes;
  }

  pushChange(changes, "guest", "Gast", guestName(before), guestName(after));
  pushChange(
    changes,
    "party_size",
    "Personen",
    strOrDash(before.party_size),
    strOrDash(after.party_size),
  );
  pushChange(
    changes,
    "starts_at",
    "Termin",
    formatReservationSlotDe(before.starts_at),
    formatReservationSlotDe(after.starts_at),
  );
  pushChange(
    changes,
    "guest_phone",
    "Telefon",
    strOrDash(before.guest_phone),
    strOrDash(after.guest_phone),
  );
  pushChange(
    changes,
    "guest_email",
    "E-Mail",
    strOrDash(before.guest_email),
    strOrDash(after.guest_email),
  );
  pushChange(
    changes,
    "status",
    "Status",
    before.status_name,
    after.status_name,
  );
  pushChange(
    changes,
    "table",
    "Tisch",
    before.dining_table_label,
    after.dining_table_label,
  );
  pushChange(
    changes,
    "dwell_minutes",
    "Verweildauer (Min.)",
    strOrDash(before.dwell_minutes),
    strOrDash(after.dwell_minutes),
  );
  pushChange(
    changes,
    "notify_email",
    "E-Mail-Benachrichtigung",
    boolDe(before.notify_email),
    boolDe(after.notify_email),
  );
  pushChange(
    changes,
    "notify_whatsapp",
    "WhatsApp-Benachrichtigung",
    boolDe(before.notify_whatsapp),
    boolDe(after.notify_whatsapp),
  );
  pushChange(
    changes,
    "terms_accepted",
    "AGB akzeptiert",
    boolDe(before.terms_accepted),
    boolDe(after.terms_accepted),
  );
  pushChange(
    changes,
    "notes",
    "Interne Notiz",
    strOrDash(before.notes),
    strOrDash(after.notes),
  );

  return changes;
}

export function buildReservationLogDetails(
  changes: ReservationLogChange[],
  options?: {
    actorGivenName?: string;
    actorFamilyName?: string;
    actorSource?: ReservationLogDetails["actorSource"];
    summary?: string;
  },
): ReservationLogDetails {
  return {
    actorGivenName: options?.actorGivenName ?? "",
    actorFamilyName: options?.actorFamilyName ?? "",
    actorSource: options?.actorSource ?? "staff",
    changes,
    summary: options?.summary,
  };
}
