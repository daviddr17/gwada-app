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

/** Gruppiert Display-Segmente einer Schicht (shift_id) zu einer Zeile pro Tag. */
export function groupWorkHoursDayEntries(
  entries: RestaurantStaffWorkEntryRow[],
  options?: {
    /** Übersicht „Alle Mitarbeiter“: zuerst Name, dann Startzeit. */
    staffNameById?: ReadonlyMap<string, string>;
  },
): WorkHoursListItem[] {
  const manual: WorkHoursListItem[] = [];
  const displayByShift = new Map<string, RestaurantStaffWorkEntryRow[]>();

  for (const e of entries) {
    if (e.shift_id && e.note === "Display") {
      const list = displayByShift.get(e.shift_id) ?? [];
      list.push(e);
      displayByShift.set(e.shift_id, list);
      continue;
    }
    manual.push({ kind: "entry", entry: e });
  }

  const display: WorkHoursListItem[] = [...displayByShift.entries()].map(
    ([shiftId, segments]) => ({
      kind: "display_shift" as const,
      shiftId,
      segments: [...segments].sort(
        (a, b) =>
          new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
      ),
    }),
  );

  const out = [...manual, ...display];
  out.sort((a, b) => {
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
  return out;
}

export function displayShiftBounds(
  segments: RestaurantStaffWorkEntryRow[],
  now: Date = new Date(),
): { startsAt: string; endsAt: string | null; isOpen: boolean } {
  const sorted = [...segments].sort(
    (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
  );
  const startsAt = sorted[0]!.starts_at;
  const last = sorted[sorted.length - 1]!;
  const isOpen = Boolean(last.is_open);
  return {
    startsAt,
    endsAt: isOpen ? null : last.ends_at,
    isOpen,
  };
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
      segments: [...segments].sort(
        (a, b) =>
          new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
      ),
    });
  }

  out.sort(
    (a, b) => new Date(b.endsAt).getTime() - new Date(a.endsAt).getTime(),
  );
  return out;
}
