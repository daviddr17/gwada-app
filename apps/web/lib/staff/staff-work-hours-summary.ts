import { localDayKey } from "@/lib/staff/shift-schedule-range";
import {
  displayShiftNetWorkHours,
  groupWorkHoursDayEntries,
} from "@/lib/staff/staff-work-hours-display";
import type { RestaurantStaffWorkEntryRow } from "@/lib/types/staff";

export type StaffWorkHoursSummary = {
  /** Summe Arbeitszeit-Einträge (Bubble: „eingeloggt“). */
  loggedH: number;
  breakH: number;
  /** Zahlbare Netto-Arbeitszeit — gleiche Logik wie Schicht-Zeilen (Display). */
  netWorkH: number;
  /** Anwesenheit brutto (Arbeit + Pause), nur zur Einordnung. */
  presenceH: number;
  vacationDays: number;
  /** Eindeutige Kranktage (Mitarbeiter × Kalendertag). */
  sickDays: number;
};

function entryDurationMs(
  e: Pick<RestaurantStaffWorkEntryRow, "starts_at" | "ends_at" | "is_open">,
  now: Date,
): number {
  const startMs = new Date(e.starts_at).getTime();
  const endMs = e.is_open ? now.getTime() : new Date(e.ends_at).getTime();
  return Math.max(0, endMs - startMs);
}

/**
 * Netto über Schicht-Gruppen: bei sequentiellen Display-Segmenten sind Work-Segmente
 * bereits netto (Pause nicht noch einmal abziehen); bei Pause *in* Work wird abgezogen.
 */
export function netWorkHoursFromWorkBreakEntries(
  workBreakEntries: readonly RestaurantStaffWorkEntryRow[],
  now: Date = new Date(),
): { loggedH: number; breakH: number; netWorkH: number; presenceH: number } {
  let workMs = 0;
  let breakMs = 0;
  let netMs = 0;

  for (const item of groupWorkHoursDayEntries([...workBreakEntries])) {
    if (item.kind === "entry") {
      const ms = entryDurationMs(item.entry, now);
      if (item.entry.entry_type === "work") {
        workMs += ms;
        netMs += ms;
      } else if (item.entry.entry_type === "break") {
        breakMs += ms;
      }
      continue;
    }

    for (const s of item.segments) {
      const ms = entryDurationMs(s, now);
      if (s.entry_type === "work") workMs += ms;
      else if (s.entry_type === "break") breakMs += ms;
    }
    netMs += displayShiftNetWorkHours(item.segments, now) * 3_600_000;
  }

  return {
    loggedH: workMs / 3_600_000,
    breakH: breakMs / 3_600_000,
    netWorkH: Math.max(0, netMs) / 3_600_000,
    presenceH: (workMs + breakMs) / 3_600_000,
  };
}

export function summarizeStaffWorkEntries(
  entries: RestaurantStaffWorkEntryRow[],
  now: Date = new Date(),
): StaffWorkHoursSummary {
  let vacationDays = 0;
  const sickDayKeys = new Set<string>();
  const workBreak: RestaurantStaffWorkEntryRow[] = [];

  for (const e of entries) {
    if (e.entry_type === "vacation") vacationDays += 1;
    else if (e.entry_type === "sick") {
      sickDayKeys.add(`${e.staff_id}:${localDayKey(new Date(e.starts_at))}`);
    } else if (e.entry_type === "work" || e.entry_type === "break") {
      workBreak.push(e);
    }
  }

  const hours = netWorkHoursFromWorkBreakEntries(workBreak, now);
  return {
    ...hours,
    vacationDays,
    sickDays: sickDayKeys.size,
  };
}

export function entryDurationHours(e: RestaurantStaffWorkEntryRow): number {
  const ms =
    new Date(e.ends_at).getTime() - new Date(e.starts_at).getTime();
  return Math.max(0, ms / 3_600_000);
}

/** Deutsche Dezimalstunden, Standard 2 Nachkommastellen (z. B. 1,50 h). */
export function formatHoursDe(hours: number, fractionDigits = 2): string {
  return `${hours.toFixed(fractionDigits).replace(".", ",")} h`;
}

/** Zeitspanne + Dauer, z. B. „12:00 – 13:30 · 1,50 h“. */
export function formatWorkTimeRangeWithHoursDe(
  rangeLabel: string,
  hours: number | null | undefined,
): string {
  if (hours == null || !Number.isFinite(hours)) return rangeLabel;
  return `${rangeLabel} · ${formatHoursDe(hours)}`;
}

export function formatStaffWorkHoursSummaryLine(
  summary: StaffWorkHoursSummary,
): string {
  return [
    `Eingeloggt ${formatHoursDe(summary.loggedH)}`,
    `Pause ${formatHoursDe(summary.breakH)}`,
    `Netto-Arbeitszeit ${formatHoursDe(summary.netWorkH)}`,
    `Urlaub ${summary.vacationDays} Eintrag${summary.vacationDays === 1 ? "" : "e"}`,
    `Krank ${summary.sickDays} Tag${summary.sickDays === 1 ? "" : "e"}`,
  ].join(" · ");
}
