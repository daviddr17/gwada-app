"use client";

import { CalendarRange, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { localDayKey } from "@/lib/staff/shift-schedule-range";
import type { RestaurantStaffScheduledShiftRow } from "@/lib/types/staff-shift-schedule";
import type { ComponentPropsWithoutRef } from "react";

/** Quadratischer Griff (3×3 Punkte) am unteren Kartenrand. */
export const shiftPlanShiftDragHandleClassName =
  "pointer-events-auto mx-auto mt-2 mb-0.5 flex size-4 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground active:cursor-grabbing hover:bg-muted/30";

export function ShiftPlanShiftDragHandle({
  className,
  ...props
}: ComponentPropsWithoutRef<"button">) {
  return (
    <button type="button" className={cn(shiftPlanShiftDragHandleClassName, className)} {...props}>
      <span className="grid grid-cols-3 gap-px" aria-hidden>
        {Array.from({ length: 9 }, (_, i) => (
          <span key={i} className="size-[2.5px] rounded-full bg-current opacity-65" />
        ))}
      </span>
    </button>
  );
}

/**
 * Feste Höhe eines Schicht-Chips im Raster (Inhalt + Abstand + Griff unten).
 * Chip und leeres „+“ nutzen dieselbe Klasse.
 */
export const shiftPlanShiftSlotClassName = "h-[3.875rem] min-h-[3.875rem] shrink-0";

const shiftPlanAddButtonBaseClassName =
  "pointer-events-auto flex w-full shrink-0 items-center justify-center border border-dashed border-border/60 text-muted-foreground transition-colors hover:border-accent/50 hover:bg-muted/20 hover:text-foreground";

/** Leere Zelle: ein „+“ exakt in Schicht-Höhe (kein separater Kasten darüber). */
export const shiftPlanAddShiftSlotButtonClassName = cn(
  shiftPlanAddButtonBaseClassName,
  shiftPlanShiftSlotClassName,
  "rounded-lg bg-transparent shadow-none",
);

/** Unter bestehenden Schichten: kompaktes „+“. */
export const shiftPlanAddShiftCompactButtonClassName = cn(
  shiftPlanAddButtonBaseClassName,
  "h-7 rounded-md bg-transparent shadow-none",
);

/** Verfügbarkeit vormerken (ohne Schicht). */
export function ShiftPlanAddAvailabilityCompactButton({
  onClick,
}: {
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        shiftPlanAddShiftCompactButtonClassName,
        "gap-1 px-1 text-[10px] font-medium",
      )}
      onClick={onClick}
      aria-label="Verfügbarkeit vormerken"
      title="Verfügbarkeit vormerken"
    >
      <CalendarRange className="size-3 shrink-0" aria-hidden />
      <span className="truncate">Verfügbar</span>
    </button>
  );
}

/** Unsichtbarer Abstandshalter = 1 Schicht-Slot (Zeilenhöhe angleichen). */
export function ShiftPlanShiftSlotSpacer() {
  return (
    <div
      aria-hidden
      className={cn(shiftPlanShiftSlotClassName, "rounded-lg border border-transparent")}
    />
  );
}

type ShiftPlanAddShiftSlotButtonProps = {
  onClick: () => void;
};

export function ShiftPlanAddShiftSlotButton({ onClick }: ShiftPlanAddShiftSlotButtonProps) {
  return (
    <button
      type="button"
      className={shiftPlanAddShiftSlotButtonClassName}
      onClick={onClick}
      aria-label="Schicht hinzufügen"
    >
      <Plus className="size-3.5" />
    </button>
  );
}

/** Max. Einträge (Schichten + Abwesenheit) pro Mitarbeiter-Zeile. */
export function maxShiftsPerStaffRow(
  staffId: string,
  days: readonly Date[],
  shiftsByCell: ReadonlyMap<string, RestaurantStaffScheduledShiftRow[]>,
  absencesByCell?: ReadonlyMap<string, readonly unknown[]>,
): number {
  let max = 0;
  for (const day of days) {
    const key = `${staffId}__${localDayKey(day)}`;
    const absenceCount = absencesByCell?.get(key)?.length ?? 0;
    if (absenceCount > 0) {
      max = Math.max(max, absenceCount);
      continue;
    }
    max = Math.max(max, (shiftsByCell.get(key)?.length ?? 0));
  }
  return max;
}

/** Sanfte Höhenänderung beim Wechsel zwischen Wochen mit unterschiedlich vielen Schichten. */
export const shiftPlanLayoutTransitionClassName = cn(
  "transition-[height,min-height] duration-200 ease-out motion-reduce:transition-none",
);

export const shiftPlanLayoutMotionTransition = {
  duration: 0.2,
  ease: [0.25, 0.1, 0.25, 1] as const,
};

/** Feste Breite der sticky Mitarbeiter-Spalte (Name + Stundenzeile). */
export const SHIFT_PLAN_STAFF_COLUMN_REM = 11.5;
export const shiftPlanStaffColumnClassName =
  "box-border w-[11.5rem] min-w-[11.5rem] max-w-[11.5rem]";

/** Feste Breite der Tages-Spalten (Datum variiert nicht in der Breite). */
export const SHIFT_PLAN_DAY_COLUMN_REM = 6.25;
export const shiftPlanDayColumnClassName =
  "box-border w-[6.25rem] min-w-[6.25rem] max-w-[6.25rem]";

/** Feste Breite der Wochen-Pfeil-Spalten. */
export const SHIFT_PLAN_WEEK_NAV_COLUMN_REM = 2.5;
export const shiftPlanWeekNavColumnClassName =
  "box-border w-10 min-w-[2.5rem] max-w-[2.5rem]";

/**
 * Tabellen-Mindestbreite = Summe der Spaltenbreiten.
 * Feste `min-w-[48rem]` bläht die Namensspalte in der Tagesansicht auf
 * (eine Tages-Spalte + Nav ≪ 48rem → table-fixed verteilt Restbreite).
 */
export function shiftPlanTableMinWidthRem(
  dayCount: number,
  showWeekNav: boolean,
): number {
  return (
    SHIFT_PLAN_STAFF_COLUMN_REM +
    Math.max(0, dayCount) * SHIFT_PLAN_DAY_COLUMN_REM +
    (showWeekNav ? 2 * SHIFT_PLAN_WEEK_NAV_COLUMN_REM : 0)
  );
}
