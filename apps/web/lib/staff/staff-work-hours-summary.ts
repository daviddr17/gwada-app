import { localDayKey } from "@/lib/staff/shift-schedule-range";
import {
  displayShiftHoursBreakdown,
  groupWorkHoursDayEntries,
} from "@/lib/staff/staff-work-hours-display";
import type { RestaurantStaffWorkEntryRow } from "@/lib/types/staff";

export type StaffWorkHoursSummary = {
  /** Anwesenheit (Union Arbeit+Pause) — „Eingeloggt“ in UI/Abrechnung. */
  loggedH: number;
  breakH: number;
  /** Zahlbare Netto-Arbeitszeit — Pause nur abziehen, wenn sie in Work liegt. */
  netWorkH: number;
  /** Alias zu loggedH (Anwesenheit). */
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
 * Netto + Eingeloggt über Schicht-Gruppen.
 * Display (Work|Pause|Work): Eingeloggt = Union, Netto = Summe Work.
 * Bubble/ArbZG (Pause in Work): Eingeloggt = Work-Spanne, Netto = Work − Pause.
 */
export function netWorkHoursFromWorkBreakEntries(
  workBreakEntries: readonly RestaurantStaffWorkEntryRow[],
  now: Date = new Date(),
): { loggedH: number; breakH: number; netWorkH: number; presenceH: number } {
  let breakMs = 0;
  let netMs = 0;
  let presenceMs = 0;

  for (const item of groupWorkHoursDayEntries([...workBreakEntries])) {
    if (item.kind === "entry") {
      const ms = entryDurationMs(item.entry, now);
      if (item.entry.entry_type === "work") {
        netMs += ms;
        presenceMs += ms;
      } else if (item.entry.entry_type === "break") {
        breakMs += ms;
        presenceMs += ms;
      }
      continue;
    }

    const breakdown = displayShiftHoursBreakdown(item.segments, now);
    breakMs += breakdown.breakMs;
    netMs += breakdown.netMs;
    presenceMs += breakdown.presenceMs;
  }

  const presenceH = Math.max(0, presenceMs) / 3_600_000;
  return {
    loggedH: presenceH,
    breakH: breakMs / 3_600_000,
    netWorkH: Math.max(0, netMs) / 3_600_000,
    presenceH,
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
