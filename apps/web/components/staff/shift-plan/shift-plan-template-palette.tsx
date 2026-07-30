"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RestaurantShiftTemplateRow } from "@/lib/types/staff-shift-schedule";
import { formatShiftTimeRangeDe } from "@/lib/types/staff-shift-schedule";
import { applyTemplateTimesToDay } from "@/lib/staff/shift-schedule-range";
import {
  SHIFT_PLAN_ABSENCE_PRESETS,
  type ShiftPlanAbsenceEntryType,
} from "@/lib/staff/shift-plan-absence";

type ShiftPlanTemplatePaletteProps = {
  templates: RestaurantShiftTemplateRow[];
  referenceDay: Date;
  onCreateTemplate: () => void;
  onEditTemplate: (template: RestaurantShiftTemplateRow) => void;
  /** Bleibt beim Scrollen oben (Vorlagen weiter ziehbar). */
  sticky?: boolean;
  className?: string;
};

const shiftPlanPaletteChipClassName =
  "inline-flex shrink-0 min-w-[8.5rem] items-stretch rounded-lg border text-left transition-shadow hover:shadow-sm";

function DraggableTemplate({
  template,
  referenceDay,
  onEdit,
}: {
  template: RestaurantShiftTemplateRow;
  referenceDay: Date;
  onEdit: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `template-${template.id}`,
      data: { type: "template", templateId: template.id },
    });

  const preview = applyTemplateTimesToDay(
    referenceDay,
    template.start_time,
    template.end_time,
  );
  const timeRange = formatShiftTimeRangeDe(preview.startsAt, preview.endsAt);

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        borderColor: `${template.color}55`,
        backgroundColor: `${template.color}12`,
      }}
      className={cn(
        shiftPlanPaletteChipClassName,
        "select-none",
        isDragging && "z-20 opacity-50 shadow-md",
      )}
    >
      <button
        type="button"
        style={{ touchAction: "none" }}
        className="flex shrink-0 cursor-grab items-center px-1 text-muted-foreground active:cursor-grabbing"
        aria-label={`${template.name} verschieben`}
        {...listeners}
        {...attributes}
      >
        <GripVertical className="size-3.5" />
      </button>
      <div className="min-w-0 flex-1 py-1.5 pr-1">
        <span className="block truncate text-xs font-medium text-foreground">
          {template.name}
        </span>
        <span className="mt-0.5 block text-[11px] tabular-nums text-muted-foreground">
          {timeRange}
        </span>
      </div>
      <button
        type="button"
        className="flex shrink-0 items-center px-1.5 text-muted-foreground hover:text-foreground"
        aria-label={`${template.name} bearbeiten`}
        onClick={(e) => {
          e.stopPropagation();
          onEdit();
        }}
      >
        <Pencil className="size-3.5" />
      </button>
    </div>
  );
}

function DraggableAbsencePreset({
  entryType,
  label,
  color,
}: {
  entryType: ShiftPlanAbsenceEntryType;
  label: string;
  color: string;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `absence-${entryType}`,
      data: { type: "absence", entryType },
    });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        borderColor: `${color}55`,
        backgroundColor: `${color}12`,
      }}
      className={cn(
        shiftPlanPaletteChipClassName,
        "select-none",
        isDragging && "z-20 opacity-50 shadow-md",
      )}
    >
      <button
        type="button"
        style={{ touchAction: "none" }}
        className="flex shrink-0 cursor-grab items-center px-1 text-muted-foreground active:cursor-grabbing"
        aria-label={`${label} verschieben`}
        {...listeners}
        {...attributes}
      >
        <GripVertical className="size-3.5" />
      </button>
      <div className="min-w-0 flex-1 py-1.5 pr-2">
        <span className="block truncate text-xs font-medium text-foreground">
          {label}
        </span>
        <span className="mt-0.5 block text-[11px] text-muted-foreground">
          Ganztägig · Arbeitszeiten
        </span>
      </div>
    </div>
  );
}

function TemplatePaletteNewButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        shiftPlanPaletteChipClassName,
        "border-border/60 bg-card hover:border-border",
      )}
    >
      <span className="flex shrink-0 items-center px-1 text-muted-foreground">
        <Plus className="size-3.5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 py-1.5 pr-1">
        <span className="block truncate text-xs font-medium text-foreground">
          Neu
        </span>
        <span className="mt-0.5 block text-[11px] text-muted-foreground">
          Vorlage
        </span>
      </div>
      <span className="w-7 shrink-0" aria-hidden />
    </button>
  );
}

export function ShiftPlanTemplatePalette({
  templates,
  referenceDay,
  onCreateTemplate,
  onEditTemplate,
  sticky = false,
  className,
}: ShiftPlanTemplatePaletteProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/50 bg-muted/10",
        sticky &&
          "sticky top-0 z-20 -mx-4 rounded-none border-x-0 border-t-0 border-border/60 bg-background/95 shadow-sm backdrop-blur-md supports-backdrop-filter:bg-background/90 sm:mx-0 sm:rounded-xl sm:border sm:border-border/60",
        className,
      )}
    >
      <div
        className={cn(
          "min-w-0 overflow-x-auto overflow-y-hidden overscroll-x-contain touch-pan-x",
          "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          "sm:overflow-visible",
        )}
      >
        <div
          className={cn(
            "flex w-max min-w-full flex-nowrap items-center gap-2 px-3 py-2",
            sticky && "px-4 sm:px-3",
            "sm:w-auto sm:min-w-0 sm:flex-wrap",
          )}
        >
          <TemplatePaletteNewButton onClick={onCreateTemplate} />
          {templates.map((t) => (
            <DraggableTemplate
              key={t.id}
              template={t}
              referenceDay={referenceDay}
              onEdit={() => onEditTemplate(t)}
            />
          ))}
          {SHIFT_PLAN_ABSENCE_PRESETS.map((preset) => (
            <DraggableAbsencePreset
              key={preset.entryType}
              entryType={preset.entryType}
              label={preset.label}
              color={preset.color}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export type ShiftPlanDragData =
  | { type: "template"; templateId: string }
  | { type: "shift"; shiftId: string }
  | { type: "absence"; entryType: ShiftPlanAbsenceEntryType };

export type ShiftPlanDayDropData = {
  kind: "day";
  staffId: string;
  dayKey: string;
};

export type ShiftPlanWeekDropData = {
  kind: "week";
  staffId: string;
};

export type ShiftPlanDropData = ShiftPlanDayDropData | ShiftPlanWeekDropData;

/** @deprecated Prefer ShiftPlanDayDropData / parseShiftPlanDropId */
export type ShiftPlanCellDropData = {
  staffId: string;
  dayKey: string;
};

export function shiftPlanCellDropId(staffId: string, dayKey: string): string {
  return `cell-${staffId}__${dayKey}`;
}

export function shiftPlanWeekDropId(staffId: string): string {
  return `week-${staffId}`;
}

export function parseShiftPlanCellDropId(id: string): ShiftPlanCellDropData | null {
  if (!id.startsWith("cell-")) return null;
  const rest = id.slice(5);
  const parts = rest.split("__");
  if (parts.length !== 2) return null;
  const [staffId, dayKey] = parts;
  if (!staffId || !/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) return null;
  return { staffId, dayKey };
}

export function parseShiftPlanWeekDropId(
  id: string,
): { staffId: string } | null {
  if (!id.startsWith("week-")) return null;
  const staffId = id.slice(5);
  if (!staffId) return null;
  return { staffId };
}

export function parseShiftPlanDropId(id: string): ShiftPlanDropData | null {
  const week = parseShiftPlanWeekDropId(id);
  if (week) return { kind: "week", staffId: week.staffId };
  const day = parseShiftPlanCellDropId(id);
  if (day) return { kind: "day", staffId: day.staffId, dayKey: day.dayKey };
  return null;
}
