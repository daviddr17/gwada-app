"use client";

import { cn } from "@/lib/utils";
import {
  formatAvailabilitySlotRangeDe,
  SHIFT_PLAN_AVAILABILITY_COLOR,
} from "@/lib/staff/shift-plan-availability";
import type { RestaurantStaffAvailabilitySlotRow } from "@/lib/types/staff-availability";
import { shiftPlanShiftSlotClassName } from "@/components/staff/shift-plan/shift-plan-cell-layout";

type ShiftPlanAvailabilityCardProps = {
  slots: RestaurantStaffAvailabilitySlotRow[];
  compact?: boolean;
};

export function ShiftPlanAvailabilityCard({
  slots,
  compact = false,
}: ShiftPlanAvailabilityCardProps) {
  if (slots.length === 0) return null;

  const color = SHIFT_PLAN_AVAILABILITY_COLOR;
  const label =
    slots.length === 1
      ? formatAvailabilitySlotRangeDe(slots[0]!)
      : slots.map((s) => formatAvailabilitySlotRangeDe(s)).join(", ");

  return (
    <div
      style={{
        borderColor: `${color}55`,
        backgroundColor: `${color}14`,
      }}
      className={cn(
        "flex items-stretch overflow-hidden rounded-lg border text-left shadow-sm",
        compact ? "text-[11px]" : "text-xs",
        compact && shiftPlanShiftSlotClassName,
      )}
      title="Verfügbarkeit (Mitarbeiter)"
    >
      <div className="min-w-0 flex-1 px-1.5 py-1.5">
        <p
          className={cn(
            "truncate font-medium text-foreground",
            compact && "text-[10px]",
          )}
        >
          Verfügbar
        </p>
        <p
          className={cn(
            "mt-0.5 truncate text-muted-foreground",
            compact && "text-[10px]",
          )}
        >
          {label}
        </p>
      </div>
    </div>
  );
}
