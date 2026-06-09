"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import type { RestaurantStaffScheduledShiftRow } from "@/lib/types/staff-shift-schedule";
import {
  formatShiftTimeRangeDe,
  scheduledShiftDisplayColor,
  scheduledShiftDisplayLabel,
} from "@/lib/types/staff-shift-schedule";
import {
  ShiftPlanShiftDragHandle,
  shiftPlanShiftSlotClassName,
} from "@/components/staff/shift-plan/shift-plan-cell-layout";

type ShiftPlanShiftCardProps = {
  shift: RestaurantStaffScheduledShiftRow;
  draggable?: boolean;
  compact?: boolean;
  onEdit?: () => void;
};

function ShiftPlanShiftCardText({
  label,
  timeRange,
  compact,
  pending,
}: {
  label: string;
  timeRange: string;
  compact: boolean;
  pending: boolean;
}) {
  return (
    <div className="min-w-0 flex-1 px-1.5 py-1.5">
      <p
        className={cn(
          "truncate font-normal text-muted-foreground",
          compact ? "text-[10px]" : "text-xs",
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 truncate whitespace-nowrap tabular-nums font-semibold text-foreground",
          compact ? "text-[10px]" : "text-xs",
        )}
      >
        {timeRange}
      </p>
      {!compact && pending ? (
        <p className="mt-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
          Ausstehend
        </p>
      ) : null}
    </div>
  );
}

export function ShiftPlanShiftCard({
  shift,
  draggable = true,
  compact = false,
  onEdit,
}: ShiftPlanShiftCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `shift-${shift.id}`,
      data: { type: "shift", shiftId: shift.id },
      disabled: !draggable,
    });

  const color = scheduledShiftDisplayColor(shift);
  const label = scheduledShiftDisplayLabel(shift);
  const timeRange = formatShiftTimeRangeDe(shift.starts_at, shift.ends_at);
  const pending = shift.status === "pending";

  const statusRing = pending
    ? "ring-2 ring-amber-400/60"
    : shift.status === "declined"
      ? "opacity-60 ring-1 ring-destructive/40"
      : "";

  const text = (
    <ShiftPlanShiftCardText
      label={label}
      timeRange={timeRange}
      compact={compact}
      pending={pending}
    />
  );

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        borderColor: `${color}55`,
        backgroundColor: `${color}14`,
      }}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-lg border text-left shadow-sm transition-shadow",
        compact ? "text-[11px]" : "text-xs",
        compact && shiftPlanShiftSlotClassName,
        statusRing,
        isDragging && "z-20 opacity-80 shadow-md",
      )}
    >
      {onEdit ? (
        <button
          type="button"
          className="flex min-h-0 w-full min-w-0 flex-1 text-left transition-colors hover:bg-background/40"
          onClick={onEdit}
          aria-label={`${label} bearbeiten`}
        >
          {text}
        </button>
      ) : (
        <div className="flex min-h-0 min-w-0 flex-1">{text}</div>
      )}

      {draggable ? (
        <ShiftPlanShiftDragHandle
          aria-label={`${label} verschieben`}
          {...listeners}
          {...attributes}
        />
      ) : null}
    </div>
  );
}
