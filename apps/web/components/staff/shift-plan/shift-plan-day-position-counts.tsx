"use client";

import { Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ShiftPlanDayPositionCount } from "@/lib/staff/shift-plan-day-position-counts";

/** Kompakt neben dem Datum (Wochen-/Tageskopf einer Positionsgruppe). */
export function ShiftPlanDayGroupPlannedCount({
  count,
  positionName,
  positionColor,
  className,
}: {
  count: number;
  positionName: string;
  positionColor: string;
  className?: string;
}) {
  if (count <= 0) return null;

  const title =
    count === 1
      ? `${positionName}: 1 Mitarbeiter geplant`
      : `${positionName}: ${count} Mitarbeiter geplant`;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 leading-none",
        className,
      )}
      title={title}
      aria-label={title}
    >
      <Users
        className="size-2.5 shrink-0"
        style={{ color: positionColor }}
        aria-hidden
      />
      <span className="text-[10px] font-semibold tabular-nums text-foreground">
        {count}
      </span>
    </span>
  );
}

/** Mehrere Positionen neben dem Monats-Tageskopf. */
export function ShiftPlanDayPositionCountBadges({
  counts,
  className,
}: {
  counts: readonly ShiftPlanDayPositionCount[];
  className?: string;
}) {
  if (counts.length === 0) return null;

  return (
    <span
      className={cn(
        "inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5",
        className,
      )}
    >
      {counts.map((item) => (
        <ShiftPlanDayGroupPlannedCount
          key={item.positionId ?? "none"}
          count={item.staffCount}
          positionName={item.name}
          positionColor={item.color}
        />
      ))}
    </span>
  );
}
