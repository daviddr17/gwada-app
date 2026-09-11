import type {
  ReservationLogAction,
  ReservationLogDetails,
} from "@/lib/types/reservation-log";

/**
 * Spiegel der DB-Trigger-Filter in
 * `trg_emit_notification_event_reservation_log` — Client und Server denselben
 * Live-Verlauf-Eintrag.
 */
export function shouldEmitReservationLogLiveActivity(params: {
  action: ReservationLogAction;
  details?: ReservationLogDetails | null;
}): boolean {
  const details = params.details ?? {};
  const actorSource = details.actorSource ?? "staff";
  const changes = details.changes ?? [];

  if (params.action === "change_request_submitted") return false;
  if (params.action === "created" && actorSource === "guest") return false;

  if (params.action === "updated" && changes.length === 1) {
    const only = changes[0];
    if (only?.field === "status") {
      const to = (only.to ?? "").toLowerCase();
      if (/(storn|cancel|abgesagt)/.test(to)) return false;
    }
  }

  return true;
}

export function isPureCancellationStatusChange(
  details: ReservationLogDetails | undefined | null,
): boolean {
  const changes = details?.changes ?? [];
  if (changes.length !== 1) return false;
  const only = changes[0];
  if (only?.field !== "status") return false;
  const to = (only.to ?? "").toLowerCase();
  return /(storn|cancel|abgesagt)/.test(to);
}

export function reservationLogLiveActivityStaffName(
  details: ReservationLogDetails,
): string {
  const name = [details.actorGivenName?.trim(), details.actorFamilyName?.trim()]
    .filter(Boolean)
    .join(" ");
  if (details.actorSource === "display") {
    return name ? `${name} · Display` : "Display";
  }
  if (details.actorSource === "guest") return name || "Gast";
  return name;
}

export function reservationLogLiveActivitySummary(
  details: ReservationLogDetails,
): string {
  const explicit = details.summary?.trim();
  if (explicit) return explicit;
  const changes = details.changes ?? [];
  if (changes.length === 0) return "";
  return changes
    .map((c) => {
      const label = c.label?.trim() || c.field;
      return `${label}: „${c.from ?? "—"}“ → „${c.to ?? "—"}“`;
    })
    .join(" · ");
}
