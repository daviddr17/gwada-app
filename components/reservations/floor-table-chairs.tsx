"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { ReservationListRow } from "@/lib/supabase/reservations-db";

export type TableSeatAssignment = {
  status: "free" | "occupied";
  reservationIndex?: number;
};

type SideCounts = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};

export function buildTableSeatAssignments(
  capacity: number,
  reservations: Pick<ReservationListRow, "party_size">[],
): TableSeatAssignment[] {
  const cap = Math.max(0, Math.min(16, Math.round(capacity) || 0));
  if (cap === 0) return [];
  const seats: TableSeatAssignment[] = Array.from({ length: cap }, () => ({
    status: "free",
  }));
  let idx = 0;
  for (let ri = 0; ri < reservations.length; ri++) {
    const ps = Math.max(0, Math.round(reservations[ri].party_size) || 0);
    for (let p = 0; p < ps && idx < cap; p++) {
      seats[idx] = { status: "occupied", reservationIndex: ri };
      idx++;
    }
  }
  return seats;
}

/** Stühle außen: zuerst gegenüber (quer oben/unten, hoch links/rechts), Rest an den kurzen Seiten. */
export function seatCountsBySide(
  capacity: number,
  layoutWide: boolean,
): SideCounts {
  const n = Math.max(0, Math.min(16, Math.round(capacity) || 0));
  const order: (keyof SideCounts)[] = layoutWide
    ? ["top", "bottom", "left", "right"]
    : ["left", "right", "top", "bottom"];
  const z: SideCounts = { top: 0, bottom: 0, left: 0, right: 0 };
  if (n === 0) return z;

  let rem = n;
  const primary = Math.min(rem, 4);
  z[order[0]] = Math.ceil(primary / 2);
  z[order[1]] = Math.floor(primary / 2);
  rem = n - z[order[0]] - z[order[1]];

  for (let i = 2; i < order.length && rem > 0; i++) {
    const add = Math.min(2, rem);
    z[order[i]] = add;
    rem -= add;
  }

  let guard = 0;
  while (rem > 0 && guard++ < 32) {
    for (const side of order) {
      if (rem <= 0) break;
      if (z[side] < 4) {
        z[side]++;
        rem--;
      }
    }
  }
  return z;
}

function chairIconPx(
  cellW: number,
  cellH: number,
  capacity: number,
  counts: SideCounts,
): number {
  const cap = Math.max(1, capacity);
  const maxOnSide = Math.max(
    counts.top,
    counts.bottom,
    counts.left,
    counts.right,
    1,
  );
  const innerW = cellW * 0.72;
  const innerH = cellH * 0.72;
  const byW = Math.floor(innerW / maxOnSide) - 2;
  const byH = Math.floor(innerH / maxOnSide) - 2;
  return Math.max(5, Math.min(11, byW, byH));
}

const CHAIR_GAP_PX = 2;

/** Abstand, um den der Tischkasten gegenüber den Stuhlreihen verkleinert wird. */
export function floorTableChairInsetPx(
  capacity: number,
  cellWpx: number,
  cellHpx: number,
  layoutWide: boolean,
): SideCounts {
  if (capacity <= 0 || cellWpx < 28 || cellHpx < 28) {
    return { top: 0, bottom: 0, left: 0, right: 0 };
  }
  const counts = seatCountsBySide(capacity, layoutWide);
  const px = chairIconPx(cellWpx, cellHpx, capacity, counts);
  const band = px + CHAIR_GAP_PX;
  return {
    top: counts.top > 0 ? band : 0,
    bottom: counts.bottom > 0 ? band : 0,
    left: counts.left > 0 ? band : 0,
    right: counts.right > 0 ? band : 0,
  };
}

function groupSeatsBySide(
  seats: TableSeatAssignment[],
  counts: SideCounts,
): Record<keyof SideCounts, TableSeatAssignment[]> {
  let i = 0;
  const take = (n: number) => {
    const slice = seats.slice(i, i + n);
    i += n;
    return slice;
  };
  if (counts.top + counts.bottom + counts.left + counts.right > 0) {
    return {
      top: take(counts.top),
      bottom: take(counts.bottom),
      left: take(counts.left),
      right: take(counts.right),
    };
  }
  return { top: [], bottom: [], left: [], right: [] };
}

function ChairGlyph({
  size,
  className,
  rotateDeg = 0,
}: {
  size: number;
  className?: string;
  rotateDeg?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      className={cn("shrink-0", className)}
      style={
        rotateDeg !== 0
          ? { transform: `rotate(${rotateDeg}deg)` }
          : undefined
      }
      aria-hidden
    >
      <path
        d="M3 5.2h6v3.2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5.2z"
        fill="currentColor"
      />
      <path
        d="M3.4 5.2V3.6c0-1 .9-1.8 2.6-1.8s2.6.8 2.6 1.8v1.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinecap="round"
      />
    </svg>
  );
}

const OCCUPIED_TINTS = [
  "text-red-600 dark:text-red-400",
  "text-red-700 dark:text-red-300",
  "text-rose-700 dark:text-rose-300",
] as const;

function seatColorClass(seat: TableSeatAssignment): string {
  return seat.status === "free"
    ? "text-green-600 dark:text-green-400"
    : OCCUPIED_TINTS[seat.reservationIndex ?? 0] ?? OCCUPIED_TINTS[0];
}

function SideChairs({
  side,
  seats,
  chairPx,
}: {
  side: keyof SideCounts;
  seats: TableSeatAssignment[];
  chairPx: number;
}) {
  if (seats.length === 0) return null;
  const row = side === "top" || side === "bottom";
  const rotate =
    side === "top" ? 180 : side === "left" ? 90 : side === "right" ? -90 : 0;

  return (
    <div
      className={cn(
        "pointer-events-none absolute z-10 flex items-center justify-center gap-0.5",
        row ? "flex-row" : "flex-col",
        side === "top" &&
          "left-1/2 top-0 max-w-full -translate-x-1/2 -translate-y-full",
        side === "bottom" &&
          "bottom-0 left-1/2 max-w-full -translate-x-1/2 translate-y-full",
        side === "left" &&
          "top-1/2 left-0 max-h-full -translate-x-full -translate-y-1/2",
        side === "right" &&
          "top-1/2 right-0 max-h-full translate-x-full -translate-y-1/2",
      )}
    >
      {seats.map((seat, i) => (
        <ChairGlyph
          key={i}
          size={chairPx}
          rotateDeg={rotate}
          className={seatColorClass(seat)}
        />
      ))}
    </div>
  );
}

type FloorTableChairsAroundProps = {
  capacity: number;
  reservations: Pick<ReservationListRow, "party_size">[];
  cellWpx: number;
  cellHpx: number;
  layoutWide: boolean;
  className?: string;
};

/** Stühle außerhalb des Tischkastens (gegenüberliegende Anordnung). */
export function FloorTableChairsAround({
  capacity,
  reservations,
  cellWpx,
  cellHpx,
  layoutWide,
  className,
}: FloorTableChairsAroundProps) {
  const cap = Math.max(0, Math.min(16, Math.round(capacity) || 0));
  const counts = useMemo(
    () => seatCountsBySide(cap, layoutWide),
    [cap, layoutWide],
  );
  const seats = useMemo(
    () => buildTableSeatAssignments(cap, reservations),
    [cap, reservations],
  );
  const grouped = useMemo(
    () => groupSeatsBySide(seats, counts),
    [seats, counts],
  );
  const chairPx = chairIconPx(cellWpx, cellHpx, cap, counts);

  if (cap === 0 || cellWpx < 28 || cellHpx < 28) return null;

  const occupied = seats.filter((s) => s.status === "occupied").length;

  return (
    <div
      className={cn("pointer-events-none absolute inset-0 overflow-visible", className)}
      role="img"
      aria-label={`${occupied} von ${cap} Plätzen belegt`}
    >
      <SideChairs side="top" seats={grouped.top} chairPx={chairPx} />
      <SideChairs side="bottom" seats={grouped.bottom} chairPx={chairPx} />
      <SideChairs side="left" seats={grouped.left} chairPx={chairPx} />
      <SideChairs side="right" seats={grouped.right} chairPx={chairPx} />
    </div>
  );
}
