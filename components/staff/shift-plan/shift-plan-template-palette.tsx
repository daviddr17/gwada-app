"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
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
};

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
        touchAction: "none",
      }}
      className={cn(
        "inline-flex min-w-[8.5rem] select-none items-stretch rounded-lg border text-left transition-shadow hover:shadow-sm",
        isDragging && "z-20 opacity-50 shadow-md",
      )}
    >
      <button
        type="button"
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
        touchAction: "none",
      }}
      className={cn(
        "inline-flex min-w-[8.5rem] select-none items-stretch rounded-lg border text-left transition-shadow hover:shadow-sm",
        isDragging && "z-20 opacity-50 shadow-md",
      )}
    >
      <button
        type="button"
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

export function ShiftPlanTemplatePalette({
  templates,
  referenceDay,
  onCreateTemplate,
  onEditTemplate,
}: ShiftPlanTemplatePaletteProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/50 bg-muted/10 px-3 py-2">
      <span className="text-xs font-medium text-muted-foreground">Vorlagen</span>
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
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 gap-1 rounded-lg"
        onClick={onCreateTemplate}
      >
        <Plus className="size-3.5" />
        Neu
      </Button>
      <span className="text-[11px] text-muted-foreground">
        In Kalender ziehen
      </span>
    </div>
  );
}

export type ShiftPlanDragData =
  | { type: "template"; templateId: string }
  | { type: "shift"; shiftId: string }
  | { type: "absence"; entryType: ShiftPlanAbsenceEntryType };

export type ShiftPlanDropData = {
  staffId: string;
  dayKey: string;
};

export function shiftPlanCellDropId(staffId: string, dayKey: string): string {
  return `cell-${staffId}__${dayKey}`;
}

export function parseShiftPlanCellDropId(id: string): ShiftPlanDropData | null {
  if (!id.startsWith("cell-")) return null;
  const rest = id.slice(5);
  const parts = rest.split("__");
  if (parts.length !== 2) return null;
  const [staffId, dayKey] = parts;
  if (!staffId || !/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) return null;
  return { staffId, dayKey };
}
