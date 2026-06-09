import { localDayKey } from "@/lib/staff/shift-schedule-range";
import { isShiftPlanAbsenceEntry } from "@/lib/staff/shift-plan-absence";
import type {
  RestaurantStaffWorkEntryRow,
  StaffWorkEntryType,
} from "@/lib/types/staff";

const timeDe = new Intl.DateTimeFormat("de-DE", {
  hour: "2-digit",
  minute: "2-digit",
});

export type StaffWorkEntryValidationResult =
  | { ok: true }
  | { ok: false; message: string };

type TimeRange = { startMs: number; endMs: number };

function toRange(startsAt: string, endsAt: string, isOpen?: boolean): TimeRange {
  const startMs = new Date(startsAt).getTime();
  let endMs = new Date(endsAt).getTime();
  if (isOpen) {
    endMs = Math.max(endMs, Date.now());
  }
  return { startMs, endMs };
}

function rangesOverlap(a: TimeRange, b: TimeRange): boolean {
  return a.startMs < b.endMs && b.startMs < a.endMs;
}

function rangeContains(outer: TimeRange, inner: TimeRange): boolean {
  return outer.startMs <= inner.startMs && inner.endMs <= outer.endMs;
}

function formatRangeLabel(startsAt: string, endsAt: string): string {
  return `${timeDe.format(new Date(startsAt))}–${timeDe.format(new Date(endsAt))}`;
}

function isTimedWorkEntry(entry: RestaurantStaffWorkEntryRow): boolean {
  return entry.entry_type === "work";
}

function isTimedBreakEntry(entry: RestaurantStaffWorkEntryRow): boolean {
  return entry.entry_type === "break";
}

function filterSiblings(
  siblings: readonly RestaurantStaffWorkEntryRow[],
  dayKey: string,
  excludeId?: string,
): RestaurantStaffWorkEntryRow[] {
  return siblings.filter((entry) => {
    if (excludeId && entry.id === excludeId) return false;
    if (isShiftPlanAbsenceEntry(entry)) return false;
    return localDayKey(new Date(entry.starts_at)) === dayKey;
  });
}

function workOverlapMessage(other: RestaurantStaffWorkEntryRow): string {
  return `Diese Arbeitszeit überschneidet sich mit einer anderen Arbeitszeit (${formatRangeLabel(other.starts_at, other.ends_at)}).`;
}

function breakOverlapMessage(other: RestaurantStaffWorkEntryRow): string {
  return `Diese Pause überschneidet sich mit einer anderen Pause (${formatRangeLabel(other.starts_at, other.ends_at)}).`;
}

function breaksOutsideWorkMessage(): string {
  return "Pause muss vollständig innerhalb einer Arbeitszeit liegen — nicht davor, danach oder ohne Arbeitszeit dazwischen.";
}

function orphanBreaksAfterWorkChangeMessage(
  brk: RestaurantStaffWorkEntryRow,
): string {
  return `Die Pause ${formatRangeLabel(brk.starts_at, brk.ends_at)} liegt außerhalb der Arbeitszeit — bitte Arbeitszeit anpassen oder Pause verschieben.`;
}

function collectWorkRanges(
  entries: readonly RestaurantStaffWorkEntryRow[],
  extra?: { startsAt: string; endsAt: string; isOpen?: boolean },
): TimeRange[] {
  const ranges = entries
    .filter(isTimedWorkEntry)
    .map((e) => toRange(e.starts_at, e.ends_at, e.is_open));
  if (extra) {
    ranges.push(toRange(extra.startsAt, extra.endsAt, extra.isOpen));
  }
  return ranges;
}

function isBreakContainedInAnyWork(
  brk: TimeRange,
  workRanges: readonly TimeRange[],
): boolean {
  return workRanges.some((work) => rangeContains(work, brk));
}

/** Client-Validierung vor Speichern (Toast-Meldung in `message`). */
export function validateStaffWorkEntryTiming(params: {
  entryType: StaffWorkEntryType;
  startsAt: string;
  endsAt: string;
  entryId?: string;
  isOpen?: boolean;
  siblings: readonly RestaurantStaffWorkEntryRow[];
}): StaffWorkEntryValidationResult {
  const dayKey = localDayKey(new Date(params.startsAt));
  const sameDay = filterSiblings(params.siblings, dayKey, params.entryId);
  const candidate = toRange(params.startsAt, params.endsAt, params.isOpen);

  if (candidate.endMs <= candidate.startMs) {
    return { ok: false, message: "Ende muss nach Beginn liegen." };
  }

  if (params.entryType === "work") {
    for (const other of sameDay.filter(isTimedWorkEntry)) {
      const otherRange = toRange(other.starts_at, other.ends_at, other.is_open);
      if (rangesOverlap(candidate, otherRange)) {
        return { ok: false, message: workOverlapMessage(other) };
      }
    }

    const workRanges = collectWorkRanges(sameDay, {
      startsAt: params.startsAt,
      endsAt: params.endsAt,
      isOpen: params.isOpen,
    });
    for (const brk of sameDay.filter(isTimedBreakEntry)) {
      const brkRange = toRange(brk.starts_at, brk.ends_at, brk.is_open);
      if (!isBreakContainedInAnyWork(brkRange, workRanges)) {
        return { ok: false, message: orphanBreaksAfterWorkChangeMessage(brk) };
      }
    }

    return { ok: true };
  }

  if (params.entryType === "break") {
    for (const other of sameDay.filter(isTimedBreakEntry)) {
      const otherRange = toRange(other.starts_at, other.ends_at, other.is_open);
      if (rangesOverlap(candidate, otherRange)) {
        return { ok: false, message: breakOverlapMessage(other) };
      }
    }

    const workRanges = collectWorkRanges(sameDay);
    if (!isBreakContainedInAnyWork(candidate, workRanges)) {
      return { ok: false, message: breaksOutsideWorkMessage() };
    }

    return { ok: true };
  }

  return { ok: true };
}
