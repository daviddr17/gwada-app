import {
  exclusiveUtcIsoAfterLocalVisibleEnd,
  localDayStartToUtcIso,
  startOfLocalDay,
} from "@/lib/reservations/month-range";
import type { ShiftScheduleViewMode } from "@/lib/types/staff-shift-schedule";

export function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function parseLocalDayKey(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return startOfLocalDay(new Date(y, m - 1, d));
}

export function startOfWeekMonday(d: Date): Date {
  const day = startOfLocalDay(d);
  const dow = day.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  day.setDate(day.getDate() + diff);
  return day;
}

export function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return startOfLocalDay(next);
}

export function daysInView(
  anchor: Date,
  view: ShiftScheduleViewMode,
): Date[] {
  if (view === "day") {
    return [startOfLocalDay(anchor)];
  }
  if (view === "week") {
    const monday = startOfWeekMonday(anchor);
    return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  }
  const monthStart = startOfLocalDay(
    new Date(anchor.getFullYear(), anchor.getMonth(), 1),
  );
  const monthEnd = startOfLocalDay(
    new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0),
  );
  const days: Date[] = [];
  for (let d = new Date(monthStart); d <= monthEnd; d = addDays(d, 1)) {
    days.push(new Date(d));
  }
  return days;
}

export function viewRangeUtcIso(
  anchor: Date,
  view: ShiftScheduleViewMode,
): { rangeStart: string; rangeEnd: string } {
  const days = daysInView(anchor, view);
  const first = days[0]!;
  const last = days[days.length - 1]!;
  return {
    rangeStart: localDayStartToUtcIso(first),
    rangeEnd: exclusiveUtcIsoAfterLocalVisibleEnd(last),
  };
}

export function formatViewTitleDe(anchor: Date, view: ShiftScheduleViewMode): string {
  if (view === "day") {
    return new Intl.DateTimeFormat("de-DE", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(anchor);
  }
  if (view === "week") {
    const days = daysInView(anchor, "week");
    const first = days[0]!;
    const last = days[6]!;
    const fmtShort = new Intl.DateTimeFormat("de-DE", {
      day: "numeric",
      month: "short",
    });
    const fmtYear = new Intl.DateTimeFormat("de-DE", { year: "numeric" });
    return `${fmtShort.format(first)} – ${fmtShort.format(last)} ${fmtYear.format(last)}`;
  }
  return new Intl.DateTimeFormat("de-DE", {
    month: "long",
    year: "numeric",
  }).format(anchor);
}

export function shiftDayKeyFromIso(iso: string): string {
  return localDayKey(new Date(iso));
}

/** Parse HH:MM or HH:MM:SS to minutes since midnight. */
export function timeStringToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function applyTemplateTimesToDay(
  day: Date,
  startTime: string,
  endTime: string,
): { startsAt: string; endsAt: string } {
  const startMin = timeStringToMinutes(startTime);
  let endMin = timeStringToMinutes(endTime);
  const base = startOfLocalDay(day);
  const starts = new Date(base);
  starts.setMinutes(startMin);
  const ends = new Date(base);
  if (endMin <= startMin) {
    endMin += 24 * 60;
    ends.setDate(ends.getDate() + 1);
  }
  ends.setMinutes(endMin % (24 * 60));
  if (endMin >= 24 * 60) {
    ends.setDate(base.getDate() + Math.floor(endMin / (24 * 60)));
  }
  return { startsAt: starts.toISOString(), endsAt: ends.toISOString() };
}

export function navigateAnchor(
  anchor: Date,
  view: ShiftScheduleViewMode,
  direction: -1 | 1,
): Date {
  if (view === "day") return addDays(anchor, direction);
  if (view === "week") return addDays(anchor, direction * 7);
  const next = new Date(anchor);
  next.setMonth(next.getMonth() + direction);
  return startOfLocalDay(new Date(next.getFullYear(), next.getMonth(), 1));
}

export const SHIFT_SCHEDULE_VIEW_LABELS: Record<ShiftScheduleViewMode, string> = {
  day: "Tag",
  week: "Woche",
  month: "Monat",
};

export const WEEKDAY_LABELS_SHORT = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"] as const;

export function weekdayLabelShort(d: Date): string {
  const dow = d.getDay();
  const idx = dow === 0 ? 6 : dow - 1;
  return WEEKDAY_LABELS_SHORT[idx] ?? "—";
}

const shiftPlanDayHeaderDateFmt = new Intl.DateTimeFormat("de-DE", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
});

/** Kompaktes Datum für Schichtplan-Spaltenköpfe (Tag, Monat, Jahr). */
export function formatShiftPlanDayHeaderDateDe(day: Date): string {
  return shiftPlanDayHeaderDateFmt.format(day);
}

/** Kalendertage zwischen zwei lokalen YYYY-MM-DD-Werten (Ziel minus Quelle). */
export function dayOffsetLocal(fromYmd: string, toYmd: string): number {
  const a = parseLocalDayKey(fromYmd).getTime();
  const b = parseLocalDayKey(toYmd).getTime();
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

/** Lesbare Bezeichnung für Tag/Woche/Monat ab Anker-Datum. */
export function formatShiftPlanPeriodLabel(
  anchorYmd: string,
  view: ShiftScheduleViewMode,
): string {
  return formatViewTitleDe(parseLocalDayKey(anchorYmd), view);
}

/** Vorschlag für Ziel-Anker: gleicher Umfang, eine Periode später — Wochentag bleibt gleich. */
export function defaultCopyTargetYmd(
  sourceYmd: string,
  sourceScope: ShiftScheduleViewMode,
): string {
  const anchor = parseLocalDayKey(sourceYmd);
  if (sourceScope === "week") return localDayKey(addDays(anchor, 7));
  if (sourceScope === "day") return localDayKey(addDays(anchor, 1));
  const next = new Date(anchor);
  next.setMonth(next.getMonth() + 1);
  return localDayKey(startOfLocalDay(next));
}

/**
 * Verschiebung in Tagen: gewähltes Quell-Datum → gewähltes Ziel-Datum
 * (z. B. Dienstag → Dienstag), unabhängig von Wochenanfang/Monatsanfang.
 */
export function copyPeriodDayOffset(
  sourceYmd: string,
  _sourceScope: ShiftScheduleViewMode,
  targetYmd: string,
  _targetScope: ShiftScheduleViewMode,
): number {
  return dayOffsetLocal(sourceYmd, targetYmd);
}

const shiftPlanCopyShortDateFmt = new Intl.DateTimeFormat("de-DE", {
  day: "numeric",
  month: "numeric",
});

/** Kompaktes Kalenderdatum für Kopier-Hinweise (z. B. „4.6.“). */
export function formatShiftPlanCopyShortDateDe(ymd: string): string {
  return shiftPlanCopyShortDateFmt.format(parseLocalDayKey(ymd));
}

export type ShiftPlanCopyUiCopy = {
  drawerHint: string;
  sourceDateFieldLabel: string;
  targetDateFieldLabel: string;
  summary: (sourceLabel: string, targetLabel: string) => string;
};

/** Lesbare Hinweise je nach Tag/Woche/Monat — Monat: Kalendertag, nicht Wochentag. */
export function getShiftPlanCopyUiCopy(
  sourceYmd: string,
  sourceScope: ShiftScheduleViewMode,
  targetYmd: string,
  targetScope: ShiftScheduleViewMode,
): ShiftPlanCopyUiCopy {
  const sourceWd = weekdayLabelShort(parseLocalDayKey(sourceYmd));
  const targetWd = weekdayLabelShort(parseLocalDayKey(targetYmd));
  const sourceShort = formatShiftPlanCopyShortDateDe(sourceYmd);
  const targetShort = formatShiftPlanCopyShortDateDe(targetYmd);
  const usesMonthScope = sourceScope === "month" || targetScope === "month";

  if (usesMonthScope) {
    return {
      drawerHint:
        "Beim Monat bleibt jedes Kalenderdatum erhalten — z. B. der 4.6. wird der 4.7., unabhängig vom Wochentag.",
      sourceDateFieldLabel: "Tag im Quellmonat",
      targetDateFieldLabel: "Tag im Zielmonat",
      summary: (sourceLabel, targetLabel) =>
        `Schichten aus ${sourceLabel} werden nach ${targetLabel} kopiert. Jeder Tag behält sein Kalenderdatum (z. B. ${sourceShort} → ${targetShort}).`,
    };
  }

  if (sourceScope === "week" || targetScope === "week") {
    return {
      drawerHint: `Bei der Woche zählt der gewählte Wochentag als Anker — z. B. ${sourceWd} wird wieder ${targetWd}.`,
      sourceDateFieldLabel: `Wochentag (${sourceWd})`,
      targetDateFieldLabel: `Ziel ab (${targetWd})`,
      summary: (sourceLabel, targetLabel) =>
        `Schichten aus ${sourceLabel} werden ab ${targetLabel} eingetragen. ${sourceWd} (${sourceShort}) wird ${targetWd} (${targetShort}) — alle anderen Tage der Woche verschieben sich entsprechend.`,
    };
  }

  return {
    drawerHint: "Einzelner Tag wird auf das gewählte Zieldatum übernommen.",
    sourceDateFieldLabel: `Quelltag (${sourceWd})`,
    targetDateFieldLabel: `Zieltag (${targetWd})`,
    summary: (sourceLabel, targetLabel) =>
      `Schichten vom ${sourceLabel} werden auf ${targetLabel} übernommen (${sourceShort} → ${targetShort}).`,
  };
}

export const SHIFT_SCHEDULE_VIEW_SELECT_OPTIONS: {
  value: ShiftScheduleViewMode;
  label: string;
}[] = (["day", "week", "month"] as const).map((mode) => ({
  value: mode,
  label: SHIFT_SCHEDULE_VIEW_LABELS[mode],
}));

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isLocalDayKey(ymd: string): boolean {
  if (!ISO_DATE_RE.test(ymd)) return false;
  const d = parseLocalDayKey(ymd);
  return localDayKey(d) === ymd;
}
