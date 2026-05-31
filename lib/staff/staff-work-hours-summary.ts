import type { RestaurantStaffWorkEntryRow } from "@/lib/types/staff";

export type StaffWorkHoursSummary = {
  loggedH: number;
  breakH: number;
  netWorkH: number;
  vacationDays: number;
};

export function summarizeStaffWorkEntries(
  entries: RestaurantStaffWorkEntryRow[],
  now: Date = new Date(),
): StaffWorkHoursSummary {
  let workMs = 0;
  let breakMs = 0;
  let vacationDays = 0;
  for (const e of entries) {
    const startMs = new Date(e.starts_at).getTime();
    const endMs = e.is_open ? now.getTime() : new Date(e.ends_at).getTime();
    const ms = Math.max(0, endMs - startMs);
    if (e.entry_type === "work") workMs += ms;
    else if (e.entry_type === "break") breakMs += ms;
    else if (e.entry_type === "vacation") vacationDays += 1;
  }
  const loggedH = (workMs + breakMs) / 3_600_000;
  const breakH = breakMs / 3_600_000;
  const netWorkH = Math.max(0, loggedH - breakH);
  return { loggedH, breakH, netWorkH, vacationDays };
}

export function entryDurationHours(e: RestaurantStaffWorkEntryRow): number {
  const ms =
    new Date(e.ends_at).getTime() - new Date(e.starts_at).getTime();
  return Math.max(0, ms / 3_600_000);
}

export function formatHoursDe(hours: number, fractionDigits = 1): string {
  return `${hours.toFixed(fractionDigits).replace(".", ",")} h`;
}

export function formatStaffWorkHoursSummaryLine(
  summary: StaffWorkHoursSummary,
): string {
  return [
    `Eingeloggt ${formatHoursDe(summary.loggedH)}`,
    `Pause ${formatHoursDe(summary.breakH)}`,
    `Arbeitszeit ${formatHoursDe(summary.netWorkH)}`,
    `Urlaub ${summary.vacationDays} Eintrag${summary.vacationDays === 1 ? "" : "e"}`,
  ].join(" · ");
}
