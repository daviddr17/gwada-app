"use client";

import { cn } from "@/lib/utils";
import {
  formatAvailabilitySlotRangeDe,
  isUnavailableAvailabilitySlot,
  SHIFT_PLAN_AVAILABILITY_COLOR,
  SHIFT_PLAN_UNAVAILABILITY_COLOR,
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

  const unavailable = slots.some(isUnavailableAvailabilitySlot);
  const color = unavailable
    ? SHIFT_PLAN_UNAVAILABILITY_COLOR
    : SHIFT_PLAN_AVAILABILITY_COLOR;
  const title = unavailable ? "Nicht verfügbar" : "Verfügbar";
  const label = unavailable
    ? "Ganztägig"
    : slots.length === 1
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
      title={
        unavailable
          ? "Nicht verfügbar (Mitarbeiter)"
          : "Verfügbarkeit (Mitarbeiter)"
      }
    >
      <div className="min-w-0 flex-1 px-1.5 py-1.5">
        <p
          className={cn(
            "truncate font-medium text-foreground",
            compact && "text-[10px]",
          )}
        >
          {title}
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
