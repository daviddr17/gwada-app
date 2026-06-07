"use client";

import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RestaurantStaffWorkEntryRow } from "@/lib/types/staff";
import { STAFF_WORK_ENTRY_LABELS } from "@/lib/types/staff";
import { shiftPlanShiftSlotClassName } from "@/components/staff/shift-plan/shift-plan-cell-layout";
import {
  SHIFT_PLAN_ABSENCE_COLORS,
  type ShiftPlanAbsenceEntryType,
} from "@/lib/staff/shift-plan-absence";

type ShiftPlanAbsenceCardProps = {
  entry: RestaurantStaffWorkEntryRow & { entry_type: ShiftPlanAbsenceEntryType };
  compact?: boolean;
  onDelete?: () => void;
};

export function ShiftPlanAbsenceCard({
  entry,
  compact = false,
  onDelete,
}: ShiftPlanAbsenceCardProps) {
  const label = STAFF_WORK_ENTRY_LABELS[entry.entry_type];
  const color = SHIFT_PLAN_ABSENCE_COLORS[entry.entry_type];

  return (
    <div
      style={{
        borderColor: `${color}55`,
        backgroundColor: `${color}14`,
      }}
      className={cn(
        "group relative flex items-stretch overflow-hidden rounded-lg border text-left shadow-sm",
        compact ? "text-[11px]" : "text-xs",
        compact && shiftPlanShiftSlotClassName,
      )}
    >
      <div className="min-w-0 flex-1 px-1.5 py-1.5">
        <p
          className={cn(
            "truncate font-medium text-foreground",
            compact && "text-[10px]",
          )}
        >
          {label}
        </p>
        <p
          className={cn(
            "mt-0.5 text-muted-foreground",
            compact && "text-[10px]",
          )}
        >
          Ganztägig
        </p>
      </div>
      {onDelete ? (
        <button
          type="button"
          className="flex shrink-0 items-center px-1 text-muted-foreground transition-colors hover:text-destructive"
          aria-label={`${label} entfernen`}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 className={cn(compact ? "size-3" : "size-3.5")} />
        </button>
      ) : null}
    </div>
  );
}
