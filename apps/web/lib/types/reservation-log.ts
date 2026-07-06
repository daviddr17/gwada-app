export type ReservationLogAction =
  | "created"
  | "updated"
  | "deleted"
  | "change_request_submitted"
  | "change_request_approved"
  | "change_request_declined";

export type ReservationLogActorSource = "staff" | "guest" | "display";

export type ReservationLogChange = {
  field: string;
  label: string;
  from: string | null;
  to: string | null;
};

export type ReservationLogDetails = {
  actorGivenName?: string;
  actorFamilyName?: string;
  actorSource?: ReservationLogActorSource;
  changes?: ReservationLogChange[];
  summary?: string;
};

export type RestaurantReservationLogEntry = {
  id: string;
  restaurant_id: string;
  reservation_id: string | null;
  actor_user_id: string | null;
  action: ReservationLogAction;
  reservation_number: number | null;
  guest_label: string;
  details: ReservationLogDetails;
  created_at: string;
};

export function formatReservationGuestLabel(
  reservationNumber: number,
  guestFirstName: string,
  guestLastName: string,
): string {
  const name =
    `${guestFirstName.trim()} ${guestLastName.trim()}`.trim() || "Gast";
  return `#${reservationNumber} · ${name}`;
}

export function formatReservationLogActorLabel(
  details: ReservationLogDetails,
  fallback = "—",
): string {
  if (details.actorSource === "guest") return "Gast";
  if (details.actorSource === "display") return "Display";
  const name = [details.actorGivenName?.trim(), details.actorFamilyName?.trim()]
    .filter(Boolean)
    .join(" ");
  return name || fallback;
}

export function reservationLogActionLabel(action: ReservationLogAction): string {
  switch (action) {
    case "created":
      return "Angelegt";
    case "updated":
      return "Geändert";
    case "deleted":
      return "Gelöscht";
    case "change_request_submitted":
      return "Änderungsanfrage";
    case "change_request_approved":
      return "Änderung übernommen";
    case "change_request_declined":
      return "Änderung abgelehnt";
    default:
      return action;
  }
}

export function formatReservationLogDetailsSummary(
  details: ReservationLogDetails,
  action?: ReservationLogAction,
): string {
  if (details.summary?.trim()) return details.summary.trim();
  if (action === "created") return "Reservierung angelegt";
  if (action === "deleted") return "Reservierung gelöscht";
  if (action === "change_request_declined") {
    return "Änderungsanfrage abgelehnt";
  }
  const changes = details.changes ?? [];
  if (changes.length === 0) return "—";
  return changes
    .map((c) => `${c.label}: „${c.from ?? "—"}“ → „${c.to ?? "—"}“`)
    .join(" · ");
}
