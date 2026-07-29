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
  onClick?: () => void;
};

export function ShiftPlanAvailabilityCard({
  slots,
  compact = false,
  onClick,
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

  const className = cn(
    "flex w-full items-stretch overflow-hidden rounded-lg border text-left shadow-sm",
    compact ? "text-[11px]" : "text-xs",
    compact && shiftPlanShiftSlotClassName,
    onClick &&
      "transition-colors hover:brightness-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
  );

  const style = {
    borderColor: `${color}55`,
    backgroundColor: `${color}14`,
  };

  const body = (
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
  );

  if (onClick) {
    return (
      <button
        type="button"
        style={style}
        className={className}
        onClick={onClick}
        title={
          unavailable
            ? "Nicht verfügbar bearbeiten"
            : "Verfügbarkeit bearbeiten"
        }
      >
        {body}
      </button>
    );
  }

  return (
    <div
      style={style}
      className={className}
      title={
        unavailable
          ? "Nicht verfügbar (Mitarbeiter)"
          : "Verfügbarkeit (Mitarbeiter)"
      }
    >
      {body}
    </div>
  );
}
