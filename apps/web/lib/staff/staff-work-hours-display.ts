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
function clusterLegacyWorkBreakShifts(
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

  const display: WorkHoursListItem[] = [
    ...[...displayByShift.entries()].map(([shiftId, segments]) => ({
      kind: "display_shift" as const,
      shiftId,
      segments: sortSegmentsByStart(segments),
    })),
    ...displayLone,
    ...clusterLegacyWorkBreakShifts(legacyRaw),
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
  now: Date = new Date(),
): { startsAt: string; endsAt: string | null; isOpen: boolean } {
  const sorted = sortSegmentsByStart(segments);
  const startsAt = sorted[0]!.starts_at;
  const last = sorted[sorted.length - 1]!;
  const isOpen = Boolean(last.is_open);
  return {
    startsAt,
    endsAt: isOpen ? null : last.ends_at,
    isOpen,
  };
}

export function displayShiftTitle(
  segments: RestaurantStaffWorkEntryRow[],
): string {
  return segments.some(isDisplayWorkEntry) ? "Display-Schicht" : "Schicht";
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

    let workMs = 0;
    let breakMs = 0;
    for (const s of segments) {
      const ms = Math.max(
        0,
        new Date(s.ends_at).getTime() - new Date(s.starts_at).getTime(),
      );
      if (s.entry_type === "work") workMs += ms;
      else if (s.entry_type === "break") breakMs += ms;
    }

    out.push({
      shiftId,
      staffId: segments[0]!.staff_id,
      startsAt: bounds.startsAt,
      endsAt: bounds.endsAt,
      workMinutes: workMs / 60_000,
      breakMinutes: breakMs / 60_000,
      segments: sortSegmentsByStart(segments),
    });
  }

  out.sort(
    (a, b) => new Date(b.endsAt).getTime() - new Date(a.endsAt).getTime(),
  );
  return out;
}
