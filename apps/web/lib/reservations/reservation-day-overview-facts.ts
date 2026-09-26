import { isPrivateEventReservation } from "@/lib/reservations/reservation-kind";
import { reservationCountsTowardDayStats } from "@/lib/reservations/reservation-relocated-marker";

/** Zeile, die der Tageskopf der Übersicht schon zählt. */
export type ReservationDayOverviewRow = {
  id: string;
  party_size: number;
  kind?: string | null;
};

export type ReservationDayOverviewFacts = {
  /** Gast-Reservierungen, ohne Veranstaltungen und ohne Verschoben-Marker. */
  reservationCount: number;
  eventCount: number;
  /** Personen aller mitgezählten Zeilen, inklusive Veranstaltungen. */
  partySize: number;
};

/**
 * Dieselben Zahlen wie der Tageskopf in der Monatsübersicht.
 * Verschoben-Marker zählen nicht. Veranstaltungen sind extra, ihre Personen bleiben in der Summe.
 */
export function reservationDayOverviewFacts(
  rows: readonly ReservationDayOverviewRow[],
): ReservationDayOverviewFacts {
  let reservationCount = 0;
  let eventCount = 0;
  let partySize = 0;
  for (const row of rows) {
    if (!reservationCountsTowardDayStats(row)) continue;
    partySize += row.party_size;
    if (isPrivateEventReservation(row)) eventCount += 1;
    else reservationCount += 1;
  }
  return { reservationCount, eventCount, partySize };
}

function deCount(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/**
 * Feinschrift in der Tagesübersicht.
 * Mitarbeiter nur, wenn die Zahl schon vorliegt (auch 0). Veranstaltungen nur, wenn welche da sind.
 */
export function formatReservationDaySheetSummary(params: {
  reservationCount: number;
  eventCount: number;
  partySize: number;
  /** `null`, solange der Schichtplan-Zähler noch nicht da ist. */
  staffCount: number | null;
}): string {
  const parts: string[] = [];
  if (params.staffCount !== null) {
    parts.push(deCount(params.staffCount, "Mitarbeiter", "Mitarbeiter"));
  }
  parts.push(
    deCount(params.reservationCount, "Reservierung", "Reservierungen"),
  );
  if (params.eventCount > 0) {
    parts.push(deCount(params.eventCount, "Veranstaltung", "Veranstaltungen"));
  }
  parts.push(deCount(params.partySize, "Person", "Personen"));
  return parts.join(" · ");
}
