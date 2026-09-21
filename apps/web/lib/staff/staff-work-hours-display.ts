import type { RestaurantStaffWorkEntryRow } from "@/lib/types/staff";

export function isDisplayWorkEntry(e: RestaurantStaffWorkEntryRow): boolean {
  return e.note === "Display";
}

export type WorkHoursListItem =
  | { kind: "entry"; entry: RestaurantStaffWorkEntryRow }
  | { kind: "display_shift"; shiftId: string; segments: RestaurantStaffWorkEntryRow[] };

function workHoursListItemStaffId(item: WorkHoursListItem): string {
  if (item.kind === "entry") return item.entry.staff_id;
  return (
    item.segments.find((s) => s.entry_type === "work")?.staff_id ??
    item.segments[0]!.staff_id
  );
}

function workHoursListItemStartIso(item: WorkHoursListItem): string {
  if (item.kind === "entry") return item.entry.starts_at;
  return item.segments[0]!.starts_at;
}

function sortSegmentsByStart(
  segments: RestaurantStaffWorkEntryRow[],
): RestaurantStaffWorkEntryRow[] {
  return [...segments].sort(
    (a, b) =>
      new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
  );
}

/** Max. Lücke zwischen Segmenten, die noch als eine Schicht gelten (Bubble/Legacy). */
const LEGACY_SHIFT_GAP_MS = 2 * 60_000;

function segmentEndMs(e: RestaurantStaffWorkEntryRow): number {
  if (e.is_open) return Number.POSITIVE_INFINITY;
  return new Date(e.ends_at).getTime();
}

/**
 * Bubble-/manuelle Arbeit+Pause ohne `shift_id`: zeitlich aneinandergrenzende
 * Segmente desselben Mitarbeiters zu einer Schicht-Zeile clustern.
 */
export function clusterLegacyWorkBreakShifts(
  entries: RestaurantStaffWorkEntryRow[],
): WorkHoursListItem[] {
  const items: WorkHoursListItem[] = [];
  const byStaff = new Map<string, RestaurantStaffWorkEntryRow[]>();

  for (const e of entries) {
    if (e.entry_type !== "work" && e.entry_type !== "break") {
      items.push({ kind: "entry", entry: e });
      continue;
    }
    const list = byStaff.get(e.staff_id) ?? [];
    list.push(e);
    byStaff.set(e.staff_id, list);
  }

  for (const list of byStaff.values()) {
    const sorted = sortSegmentsByStart(list);
    let i = 0;
    while (i < sorted.length) {
      const segments: RestaurantStaffWorkEntryRow[] = [sorted[i]!];
      let clusterEnd = segmentEndMs(sorted[i]!);
      i += 1;
      while (i < sorted.length) {
        const next = sorted[i]!;
        const nextStart = new Date(next.starts_at).getTime();
        if (nextStart > clusterEnd + LEGACY_SHIFT_GAP_MS) break;
        segments.push(next);
        clusterEnd = Math.max(clusterEnd, segmentEndMs(next));
        i += 1;
      }
      const hasWork = segments.some((s) => s.entry_type === "work");
      // Lone Pause must stay a flat entry — wrapping as Schicht shows "0,00 h" above Pause.
      // Single work also stays flat; only Arbeit+Pause (multi-segment) is a Schicht block.
      if (!hasWork || segments.length === 1) {
        for (const s of segments) {
          items.push({ kind: "entry", entry: s });
        }
        continue;
      }
      items.push({
        kind: "display_shift",
        shiftId: `legacy-${segments[0]!.id}`,
        segments,
      });
    }
  }

  return items;
}

/**
 * Gruppiert Segmente einer Schicht (`shift_id`) zu einer Zeile pro Tag.
 * Display ohne `shift_id` und Legacy Arbeit/Pause (Bubble) werden ebenfalls
 * als Schicht-Block dargestellt — nicht als flache manuelle Zeilen.
 */
function entryIntervalMs(
  e: RestaurantStaffWorkEntryRow,
  nowMs: number,
): { start: number; end: number } | null {
  const start = new Date(e.starts_at).getTime();
  const end = e.is_open ? nowMs : new Date(e.ends_at).getTime();
  if (!(end > start)) return null;
  return { start, end };
}

function intervalsOverlap(
  a: { start: number; end: number },
  b: { start: number; end: number },
): boolean {
  return a.start < b.end && b.start < a.end;
}

/**
 * Manuelle/verwaiste Pausen, die in eine Display-/Shift-Spanne fallen,
 * der Display-Schicht zuordnen — sonst entstehen „Schicht · 0,00 h“-Karten
 * neben einer Display-Arbeitszeit, die die Pause nicht kennt.
 */
function attachOverlappingOrphanBreaks(
  shiftItems: WorkHoursListItem[],
  orphans: RestaurantStaffWorkEntryRow[],
  now: Date = new Date(),
): { shifts: WorkHoursListItem[]; remaining: RestaurantStaffWorkEntryRow[] } {
  const nowMs = now.getTime();
  const shifts = shiftItems.map((item) =>
    item.kind === "display_shift"
      ? { ...item, segments: [...item.segments] }
      : item,
  );
  const remaining: RestaurantStaffWorkEntryRow[] = [];

  for (const orphan of orphans) {
    if (orphan.entry_type !== "break") {
      remaining.push(orphan);
      continue;
    }
    const breakIv = entryIntervalMs(orphan, nowMs);
    if (!breakIv) {
      remaining.push(orphan);
      continue;
    }

    let attached = false;
    for (const item of shifts) {
      if (item.kind !== "display_shift") continue;
      if (workHoursListItemStaffId(item) !== orphan.staff_id) continue;
      const hasWork = item.segments.some((s) => s.entry_type === "work");
      if (!hasWork) continue;

      const shiftStart = Math.min(
        ...item.segments.map((s) => new Date(s.starts_at).getTime()),
      );
      const shiftEnd = Math.max(
        ...item.segments.map((s) =>
          s.is_open ? nowMs : new Date(s.ends_at).getTime(),
        ),
      );
      if (!intervalsOverlap(breakIv, { start: shiftStart, end: shiftEnd })) {
        continue;
      }
      item.segments = sortSegmentsByStart([...item.segments, orphan]);
      attached = true;
      break;
    }
    if (!attached) remaining.push(orphan);
  }

  return { shifts, remaining };
}

export function groupWorkHoursDayEntries(
  entries: RestaurantStaffWorkEntryRow[],
  options?: {
    /** Übersicht „Alle Mitarbeiter“: zuerst Name, dann Startzeit. */
    staffNameById?: ReadonlyMap<string, string>;
  },
): WorkHoursListItem[] {
  const displayByShift = new Map<string, RestaurantStaffWorkEntryRow[]>();
  const displayLone: WorkHoursListItem[] = [];
  const legacyRaw: RestaurantStaffWorkEntryRow[] = [];

  for (const e of entries) {
    if (e.shift_id) {
      const list = displayByShift.get(e.shift_id) ?? [];
      list.push(e);
      displayByShift.set(e.shift_id, list);
      continue;
    }
    if (e.note === "Display") {
      displayLone.push({
        kind: "display_shift",
        shiftId: e.id,
        segments: [e],
      });
      continue;
    }
    legacyRaw.push(e);
  }

  const baseShifts: WorkHoursListItem[] = [];
  const shiftIdOrphans: RestaurantStaffWorkEntryRow[] = [];

  for (const [shiftId, segments] of displayByShift.entries()) {
    const sorted = sortSegmentsByStart(segments);
    const hasWork = sorted.some((s) => s.entry_type === "work");
    // Pause-only shift_id groups look like "Schicht · 0,00 h" — treat as orphans.
    if (!hasWork) {
      shiftIdOrphans.push(...sorted);
      continue;
    }
    baseShifts.push({
      kind: "display_shift",
      shiftId,
      segments: sorted,
    });
  }
  baseShifts.push(...displayLone);

  const { shifts, remaining } = attachOverlappingOrphanBreaks(
    baseShifts,
    [...legacyRaw, ...shiftIdOrphans],
  );

  const display: WorkHoursListItem[] = [
    ...shifts,
    ...clusterLegacyWorkBreakShifts(remaining),
  ];

  display.sort((a, b) => {
    if (options?.staffNameById) {
      const nameA = options.staffNameById.get(workHoursListItemStaffId(a)) ?? "";
      const nameB = options.staffNameById.get(workHoursListItemStaffId(b)) ?? "";
      const byName = nameA.localeCompare(nameB, "de");
      if (byName !== 0) return byName;
    }
    return (
      new Date(workHoursListItemStartIso(a)).getTime() -
      new Date(workHoursListItemStartIso(b)).getTime()
    );
  });
  return display;
}

export function displayShiftBounds(
  segments: RestaurantStaffWorkEntryRow[],
  _now: Date = new Date(),
): { startsAt: string; endsAt: string | null; isOpen: boolean } {
  const sorted = sortSegmentsByStart(segments);
  const startsAt = sorted[0]!.starts_at;
  /** Offen, wenn irgendein Segment (Arbeit/Pause) noch läuft — nicht nur das zuletzt gestartete. */
  const isOpen = segments.some((s) => Boolean(s.is_open));
  if (isOpen) {
    return { startsAt, endsAt: null, isOpen: true };
  }
  /** Ende = spätestes Segmentende (Arbeitszeit kann über spätere Pausen hinausreichen). */
  let endsAt = sorted[0]!.ends_at;
  let endsMs = new Date(endsAt).getTime();
  for (const s of sorted) {
    const ms = new Date(s.ends_at).getTime();
    if (ms > endsMs) {
      endsMs = ms;
      endsAt = s.ends_at;
    }
  }
  return { startsAt, endsAt, isOpen: false };
}

/**
 * Netto-Arbeitszeit einer Schicht (Pausen abgezogen) — nicht die Brutto-Spanne Start–Ende.
 * Nur Pausenanteile, die mit Work-Intervallen überlappen, werden abgezogen
 * (Display: sequentielle Pause außerhalb Work → kein Abzug; Bubble/ArbZG: Pause in Work → Abzug).
 */
export function displayShiftNetWorkHours(
  segments: RestaurantStaffWorkEntryRow[],
  now: Date = new Date(),
): number {
  return displayShiftHoursBreakdown(segments, now).netMs / 3_600_000;
}

export type DisplayShiftHoursBreakdown = {
  workMs: number;
  breakMs: number;
  /** Pause, die in Work-Intervallen liegt (nur dieser Anteil geht vom Netto ab). */
  overlapBreakMs: number;
  netMs: number;
  /** Union aus Arbeit + Pause (= Anwesenheit / „Eingeloggt“). */
  presenceMs: number;
};

function intervalOverlapMs(
  a: { start: number; end: number },
  b: { start: number; end: number },
): number {
  return Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));
}


/** Zusammenhängende Intervalle mergen (Überlappung/Berührung). */
export function mergeIntervals(
  intervals: readonly { start: number; end: number }[],
): { start: number; end: number }[] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const out: { start: number; end: number }[] = [
    { start: sorted[0]!.start, end: sorted[0]!.end },
  ];
  for (let i = 1; i < sorted.length; i += 1) {
    const next = sorted[i]!;
    const cur = out[out.length - 1]!;
    if (next.start <= cur.end) {
      cur.end = Math.max(cur.end, next.end);
      continue;
    }
    out.push({ start: next.start, end: next.end });
  }
  return out;
}

export function measureIntervalsMs(
  intervals: readonly { start: number; end: number }[],
): number {
  let total = 0;
  for (const iv of mergeIntervals(intervals)) {
    total += Math.max(0, iv.end - iv.start);
  }
  return total;
}

/** Dauer der Schnittmenge zweier Intervallmengen. */
export function measureIntervalOverlapMs(
  a: readonly { start: number; end: number }[],
  b: readonly { start: number; end: number }[],
): number {
  const aa = mergeIntervals(a);
  const bb = mergeIntervals(b);
  let total = 0;
  let i = 0;
  let j = 0;
  while (i < aa.length && j < bb.length) {
    const x = aa[i]!;
    const y = bb[j]!;
    total += intervalOverlapMs(x, y);
    if (x.end < y.end) i += 1;
    else j += 1;
  }
  return total;
}

/**
 * Globale Stunden aus Work/Break-Intervallen (ohne Doppelzählung).
 * Eingeloggt = Union(Arbeit∪Pause), Netto = Union(Arbeit) − Überlappung mit Pause.
 * Überlappende manuelle Pause auf durchgehender Arbeit erhöht Eingeloggt nicht.
 */
export function workBreakHoursFromIntervals(
  workIntervals: readonly { start: number; end: number }[],
  breakIntervals: readonly { start: number; end: number }[],
): {
  loggedH: number;
  breakH: number;
  netWorkH: number;
  presenceH: number;
} {
  const workMs = measureIntervalsMs(workIntervals);
  const breakMs = measureIntervalsMs(breakIntervals);
  const presenceMs = measureIntervalsMs([...workIntervals, ...breakIntervals]);
  const overlapMs = measureIntervalOverlapMs(workIntervals, breakIntervals);
  const netMs = Math.max(0, workMs - overlapMs);
  return {
    loggedH: presenceMs / 3_600_000,
    breakH: breakMs / 3_600_000,
    netWorkH: netMs / 3_600_000,
    presenceH: presenceMs / 3_600_000,
  };
}

export function displayShiftHoursBreakdown(
  segments: RestaurantStaffWorkEntryRow[],
  now: Date = new Date(),
): DisplayShiftHoursBreakdown {
  const nowMs = now.getTime();
  const workIntervals: { start: number; end: number }[] = [];
  const breakIntervals: { start: number; end: number }[] = [];

  for (const s of segments) {
    const start = new Date(s.starts_at).getTime();
    const end = s.is_open ? nowMs : new Date(s.ends_at).getTime();
    if (!(end > start)) continue;
    if (s.entry_type === "work") workIntervals.push({ start, end });
    else if (s.entry_type === "break") breakIntervals.push({ start, end });
  }

  // Gleiche Union-/Überlappungslogik wie Abrechnung (workBreakHoursFromIntervals),
  // sonst können überlappende Work-Segmente Netto in der Schicht-Zeile aufblasen.
  const workMs = measureIntervalsMs(workIntervals);
  const breakMs = measureIntervalsMs(breakIntervals);
  const overlapBreakMs = measureIntervalOverlapMs(workIntervals, breakIntervals);
  const presenceMs = measureIntervalsMs([...workIntervals, ...breakIntervals]);

  return {
    workMs,
    breakMs,
    overlapBreakMs,
    netMs: Math.max(0, workMs - overlapBreakMs),
    presenceMs,
  };
}

export function displayShiftTitle(
  segments: RestaurantStaffWorkEntryRow[],
): string {
  if (segments.some(isDisplayWorkEntry)) return "Display-Schicht";
  const hasWork = segments.some((s) => s.entry_type === "work");
  if (!hasWork && segments.some((s) => s.entry_type === "break")) {
    return "Pause";
  }
  return "Schicht";
}

export type CompletedDisplayShift = {
  shiftId: string;
  staffId: string;
  startsAt: string;
  endsAt: string;
  workMinutes: number;
  breakMinutes: number;
  segments: RestaurantStaffWorkEntryRow[];
};

/** Abgeschlossene Display-Schichten (alle Segmente zu, shift_id gesetzt). */
export function listCompletedDisplayShifts(
  entries: RestaurantStaffWorkEntryRow[],
): CompletedDisplayShift[] {
  const byShift = new Map<string, RestaurantStaffWorkEntryRow[]>();
  for (const e of entries) {
    if (!e.shift_id) continue;
    const list = byShift.get(e.shift_id) ?? [];
    list.push(e);
    byShift.set(e.shift_id, list);
  }

  const out: CompletedDisplayShift[] = [];
  for (const [shiftId, segments] of byShift) {
    const bounds = displayShiftBounds(segments);
    if (bounds.isOpen || !bounds.endsAt) continue;

    let breakMs = 0;
    for (const s of segments) {
      if (s.entry_type !== "break") continue;
      breakMs += Math.max(
        0,
        new Date(s.ends_at).getTime() - new Date(s.starts_at).getTime(),
      );
    }

    out.push({
      shiftId,
      staffId: segments[0]!.staff_id,
      startsAt: bounds.startsAt,
      endsAt: bounds.endsAt,
      workMinutes: displayShiftNetWorkHours(segments) * 60,
      breakMinutes: breakMs / 60_000,
      segments: sortSegmentsByStart(segments),
    });
  }

  out.sort(
    (a, b) => new Date(b.endsAt).getTime() - new Date(a.endsAt).getTime(),
  );
  return out;
}
