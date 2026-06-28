"use client";

import type { StaffTodoCaptureType } from "@/lib/types/staff-todos";
import { resolveEffectiveCaptureType } from "@/lib/staff/staff-todo-capture";
import { formatDisplayTodoCapturedValue } from "@/lib/display/format-display-todo-capture";
import { cn } from "@/lib/utils";

type DisplayTodoCapturedValueProps = {
  captureType: StaffTodoCaptureType;
  targetMin?: number | null;
  targetMax?: number | null;
  checklistDevice?: {
    target_min: number | null;
    target_max: number | null;
  } | null;
  capturedNumeric?: number | null;
  capturedText?: string | null;
  withinLimits?: boolean | null;
  correctiveAction?: string | null;
  completionNote?: string | null;
  className?: string;
  /** Ohne eigenen Kasten — z. B. im Display-Erfassungs-Panel. */
  plain?: boolean;
};

export function DisplayTodoCapturedValue({
  captureType,
  targetMin,
  targetMax,
  checklistDevice,
  capturedNumeric,
  capturedText,
  withinLimits,
  correctiveAction,
  completionNote,
  className,
  plain = false,
}: DisplayTodoCapturedValueProps) {
  const effectiveType = resolveEffectiveCaptureType({
    capture_type: captureType,
    target_min: targetMin ?? null,
    target_max: targetMax ?? null,
    checklist_device: checklistDevice
      ? {
          id: "",
          name: "",
          area_id: null,
          target_min: checklistDevice.target_min,
          target_max: checklistDevice.target_max,
        }
      : null,
  });
  const valueLabel = formatDisplayTodoCapturedValue(
    effectiveType,
    capturedNumeric,
    capturedText,
  );
  const note = completionNote?.trim();
  const corrective = correctiveAction?.trim();

  if (!valueLabel && !note && !corrective) return null;

  return (
    <div
      className={cn(
        !plain &&
          "space-y-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3 py-2.5",
        plain && "space-y-1.5",
        className,
      )}
    >
      {valueLabel ? (
        <p className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">
          {valueLabel}
        </p>
      ) : null}
      {withinLimits === false ? (
        <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
          Außerhalb des Sollbereichs
        </p>
      ) : null}
      {corrective ? (
        <p className="text-sm text-foreground">
          <span className="font-medium">Korrektur:</span> {corrective}
        </p>
      ) : null}
      {note ? (
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground/80">Notiz:</span> {note}
        </p>
      ) : null}
    </div>
  );
}
