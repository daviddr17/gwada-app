import type {
  DateHoursException,
  DayHours,
  HoursPeriod,
  TimeString,
} from "@/lib/types/restaurant";

function parseHmMinutes(value: string | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value?.trim() ?? "");
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }
  return hours * 60 + minutes;
}

function minutesToHm(total: number): TimeString {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Normalisierte offene Perioden (Legacy open/close oder periods[]). */
export function dayHoursOpenPeriods(
  hours: Pick<DayHours, "closed" | "open" | "close" | "periods">,
): HoursPeriod[] {
  if (hours.closed) return [];
  if (hours.periods && hours.periods.length > 0) {
    return normalizeOpenPeriods(hours.periods);
  }
  if (hours.open?.trim() && hours.close?.trim()) {
    return normalizeOpenPeriods([
      { open: hours.open.trim(), close: hours.close.trim() },
    ]);
  }
  return [];
}

export function exceptionOpenPeriods(
  ex: Pick<DateHoursException, "closed" | "open" | "close" | "periods">,
): HoursPeriod[] {
  return dayHoursOpenPeriods(ex);
}

export function normalizeOpenPeriods(
  periods: readonly HoursPeriod[],
): HoursPeriod[] {
  const cleaned: Array<HoursPeriod & { openM: number; closeM: number }> = [];
  for (const p of periods) {
    const openM = parseHmMinutes(p.open);
    const closeM = parseHmMinutes(p.close);
    if (openM == null || closeM == null) continue;
    if (closeM <= openM) continue;
    cleaned.push({
      open: minutesToHm(openM),
      close: minutesToHm(closeM),
      openM,
      closeM,
    });
  }
  cleaned.sort((a, b) => a.openM - b.openM);

  const merged: HoursPeriod[] = [];
  for (const p of cleaned) {
    const last = merged[merged.length - 1];
    if (!last) {
      merged.push({ open: p.open, close: p.close });
      continue;
    }
    const lastClose = parseHmMinutes(last.close)!;
    if (p.openM <= lastClose) {
      last.close = minutesToHm(Math.max(lastClose, p.closeM));
    } else {
      merged.push({ open: p.open, close: p.close });
    }
  }
  return merged;
}

/**
 * Google-kompatibel: Pause als Lücke zwischen offenen Perioden.
 * Basis = Wochenplan des Tages; closedFrom–closedTo wird ausgeschnitten.
 */
export function openPeriodsAfterClosedInterval(
  base: DayHours,
  closedFrom: string,
  closedTo: string,
): HoursPeriod[] | { error: string } {
  const basePeriods = dayHoursOpenPeriods(base);
  if (basePeriods.length === 0) {
    return { error: "An diesem Wochentag ist regulär geschlossen." };
  }
  const fromM = parseHmMinutes(closedFrom);
  const toM = parseHmMinutes(closedTo);
  if (fromM == null || toM == null) {
    return { error: "Bitte gültige Zeiten für die Schließung angeben." };
  }
  if (toM <= fromM) {
    return { error: "Ende der Schließung muss nach dem Beginn liegen." };
  }

  const out: HoursPeriod[] = [];
  for (const period of basePeriods) {
    const openM = parseHmMinutes(period.open)!;
    const closeM = parseHmMinutes(period.close)!;
    // Keine Überlappung
    if (toM <= openM || fromM >= closeM) {
      out.push(period);
      continue;
    }
    if (fromM > openM) {
      out.push({ open: minutesToHm(openM), close: minutesToHm(fromM) });
    }
    if (toM < closeM) {
      out.push({ open: minutesToHm(toM), close: minutesToHm(closeM) });
    }
  }

  const normalized = normalizeOpenPeriods(out);
  if (normalized.length === 0) {
    return { error: "Die Schließung deckt die gesamte Öffnungszeit ab — bitte „Ganztägig geschlossen“ nutzen." };
  }
  return normalized;
}

export function isMinutesWithinOpenPeriods(
  minutesFromMidnight: number,
  periods: readonly HoursPeriod[],
): boolean {
  for (const p of periods) {
    const openM = parseHmMinutes(p.open);
    const closeM = parseHmMinutes(p.close);
    if (openM == null || closeM == null) continue;
    if (minutesFromMidnight >= openM && minutesFromMidnight < closeM) {
      return true;
    }
  }
  return false;
}

export function formatOpenPeriodsLabel(
  periods: readonly HoursPeriod[],
  closedLabel = "Geschlossen",
): string {
  const normalized = normalizeOpenPeriods(periods);
  if (normalized.length === 0) return closedLabel;
  return normalized.map((p) => `${p.open} – ${p.close}`).join(", ");
}

/** DayHours aus Ausnahme — inkl. periods für Mehrfachfenster. */
export function dayHoursFromException(ex: DateHoursException): DayHours {
  if (ex.closed) return { closed: true };
  const periods = exceptionOpenPeriods(ex);
  if (periods.length === 0) return { closed: true };
  return {
    closed: false,
    open: periods[0]!.open,
    close: periods[periods.length - 1]!.close,
    periods: periods.length > 1 ? periods : undefined,
  };
}

export function withSyncedLegacyOpenClose(
  ex: DateHoursException,
): DateHoursException {
  if (ex.closed) {
    return { ...ex, open: undefined, close: undefined, periods: undefined };
  }
  const periods = exceptionOpenPeriods(ex);
  if (periods.length === 0) {
    // Nicht still auf „geschlossen“ umbiegen — das unmountet Eingabefelder unter Fokus.
    // Speichern fängt leere Fenster über validateOpeningHours ab.
    return {
      ...ex,
      closed: false,
      periods: ex.periods?.length ? ex.periods : undefined,
      open: ex.open,
      close: ex.close,
    };
  }
  return {
    ...ex,
    closed: false,
    periods,
    open: periods[0]!.open,
    close: periods[periods.length - 1]!.close,
  };
}
