import {
  daysInclusive,
  localDayKey,
  startOfLocalDay,
} from "@gwada/shared";
import type { ReservationListRow } from "@/src/lib/reservations/reservations-db";

export function dayKeyFromIso(iso: string): string {
  return localDayKey(new Date(iso));
}

export function groupReservationsByDay(
  rows: ReservationListRow[],
): Map<string, ReservationListRow[]> {
  const map = new Map<string, ReservationListRow[]>();
  for (const row of rows) {
    const key = dayKeyFromIso(row.starts_at);
    const list = map.get(key);
    if (list) list.push(row);
    else map.set(key, [row]);
  }
  for (const list of map.values()) {
    list.sort(
      (a, b) =>
        new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
    );
  }
  return map;
}

export function unconfirmedDayList(byDay: Map<string, ReservationListRow[]>): Date[] {
  const keys = [...byDay.keys()].sort();
  return keys.map((k) => {
    const [y, m, d] = k.split("-").map(Number);
    return new Date(y!, (m ?? 1) - 1, d ?? 1);
  });
}

export function computeVisibleDays(params: {
  unconfirmedMode: boolean;
  days: Date[];
  byDay: Map<string, ReservationListRow[]>;
  unconfirmedDayList: Date[];
  isViewingCurrentMonth: boolean;
  hidePastReservations: boolean;
  hideEmptyDays: boolean;
  today: Date;
}): Date[] {
  const {
    unconfirmedMode,
    days,
    byDay,
    unconfirmedDayList: unconfirmedDays,
    isViewingCurrentMonth,
    hidePastReservations,
    hideEmptyDays,
    today,
  } = params;

  if (unconfirmedMode) {
    if (!hideEmptyDays) return unconfirmedDays;
    return unconfirmedDays.filter(
      (d) => (byDay.get(localDayKey(d))?.length ?? 0) > 0,
    );
  }

  let out = days;
  if (isViewingCurrentMonth && hidePastReservations) {
    out = out.filter(
      (d) => startOfLocalDay(d).getTime() >= startOfLocalDay(today).getTime(),
    );
  }
  if (hideEmptyDays) {
    out = out.filter((d) => (byDay.get(localDayKey(d))?.length ?? 0) > 0);
  }
  return out;
}

export function buildMonthDays(year: number, monthIndex: number): Date[] {
  const monthStart = startOfLocalDay(new Date(year, monthIndex, 1));
  const monthEnd = startOfLocalDay(new Date(year, monthIndex + 1, 0));
  return daysInclusive(monthStart, monthEnd);
}

export function countFilterActive(params: {
  unconfirmedMode: boolean;
  statusFilterId: string;
  isViewingCurrentMonth: boolean;
  hidePastReservations: boolean;
  hideEmptyDays: boolean;
}): number {
  const {
    unconfirmedMode,
    statusFilterId,
    isViewingCurrentMonth,
    hidePastReservations,
    hideEmptyDays,
  } = params;

  if (unconfirmedMode) {
    let n = 1;
    if (hideEmptyDays) n++;
    return n;
  }

  let n = 0;
  if (statusFilterId !== "all") n++;
  if (isViewingCurrentMonth && !hidePastReservations) n++;
  if (hideEmptyDays) n++;
  return n;
}
