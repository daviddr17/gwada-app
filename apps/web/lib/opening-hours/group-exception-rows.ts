import { exceptionOpenPeriods } from "@/lib/opening-hours/hours-periods";
import type { DateHoursException } from "@/lib/types/restaurant";

export type OpeningHoursExceptionRowLike = {
  id?: string;
  exception_date: string | null;
  closed: boolean;
  opens_at: string | null;
  closes_at: string | null;
  note?: string | null;
};

function rowTimeToHHmm(t: string | null | undefined): string | undefined {
  if (!t) return undefined;
  const m = /^(\d{1,2}):(\d{2})/.exec(t.trim());
  if (!m) return undefined;
  return `${m[1]!.padStart(2, "0")}:${m[2]}`;
}

/** DB-Zeilen (ggf. mehrere Perioden/Datum) → eine DateHoursException pro Datum. */
export function groupExceptionRowsToDateExceptions(
  rows: readonly OpeningHoursExceptionRowLike[],
): DateHoursException[] {
  const byDate = new Map<
    string,
    {
      id: string;
      closed: boolean;
      periods: Array<{ open: string; close: string }>;
      note?: string;
    }
  >();

  for (const raw of rows) {
    if (!raw.exception_date) continue;
    const date = raw.exception_date;
    const existing = byDate.get(date);
    if (raw.closed) {
      byDate.set(date, {
        id: raw.id ?? date,
        closed: true,
        periods: [],
        note: raw.note?.trim() || existing?.note,
      });
      continue;
    }
    const open = rowTimeToHHmm(raw.opens_at);
    const close = rowTimeToHHmm(raw.closes_at);
    if (!open || !close) continue;
    if (!existing || existing.closed) {
      byDate.set(date, {
        id: raw.id ?? date,
        closed: false,
        periods: [{ open, close }],
        note: raw.note?.trim() || undefined,
      });
      continue;
    }
    existing.periods.push({ open, close });
    if (!existing.note && raw.note?.trim()) {
      existing.note = raw.note.trim();
    }
  }

  const out: DateHoursException[] = [];
  for (const [date, value] of byDate) {
    if (value.closed) {
      out.push({
        id: value.id,
        date,
        closed: true,
        note: value.note,
      });
      continue;
    }
    const periods = exceptionOpenPeriods({
      closed: false,
      periods: value.periods,
    });
    out.push({
      id: value.id,
      date,
      closed: false,
      periods,
      open: periods[0]?.open,
      close: periods[periods.length - 1]?.close,
      note: value.note,
    });
  }

  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}
