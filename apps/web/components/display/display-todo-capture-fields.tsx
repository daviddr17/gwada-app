"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { StaffTodoCaptureType, RestaurantStaffTodoRow } from "@/lib/types/staff-todos";
import { staffTodoLimitsLabel } from "@/lib/staff/staff-todo-meta";
import type { StaffTodoCaptureLimits } from "@/lib/staff/staff-todo-capture";
import {
  evaluateStaffTodoCapture,
  staffTodoNeedsCaptureInput,
} from "@/lib/staff/staff-todo-capture";
import { cn } from "@/lib/utils";

export type DisplayTodoCaptureState = {
  numeric: string;
  text: string;
  boolean: boolean;
  corrective: string;
};

export const EMPTY_DISPLAY_TODO_CAPTURE: DisplayTodoCaptureState = {
  numeric: "",
  text: "",
  boolean: false,
  corrective: "",
};

type DisplayTodoCaptureFieldsProps = {
  captureType: StaffTodoCaptureType;
  limits: StaffTodoCaptureLimits;
  limitsLabel?: string | null;
  values: DisplayTodoCaptureState;
  onChange: (next: DisplayTodoCaptureState) => void;
  showCorrective: boolean;
  large?: boolean;
};

export function displayTodoCapturePayloadFromState(
  captureType: StaffTodoCaptureType,
  values: DisplayTodoCaptureState,
) {
  const numericRaw = values.numeric.trim().replace(",", ".");
  const numeric =
    numericRaw === "" ? null : Number.parseFloat(numericRaw);
  return {
    captured_numeric:
      numeric != null && !Number.isNaN(numeric) ? numeric : null,
    captured_text: values.text.trim() || null,
    captured_boolean: values.boolean,
    corrective_action: values.corrective.trim() || null,
  };
}

/** Boolean-Erfassung läuft über den Erledigt-Schalter — kein separates Feld. */
export function displayTodoCapturePayloadForComplete(
  captureType: StaffTodoCaptureType,
  values: DisplayTodoCaptureState,
) {
  if (captureType === "boolean") {
    return { captured_boolean: true };
  }
  return displayTodoCapturePayloadFromState(captureType, values);
}

export function displayTodoCaptureReadyForComplete(
  todo: Pick<
    RestaurantStaffTodoRow,
    | "capture_type"
    | "target_min"
    | "target_max"
    | "require_corrective_on_deviation"
    | "checklist_device"
  >,
  values: DisplayTodoCaptureState,
): boolean {
  if (todo.capture_type === "boolean") return true;
  if (!staffTodoNeedsCaptureInput(todo.capture_type)) return true;
  const payload = displayTodoCapturePayloadFromState(todo.capture_type, values);
  return evaluateStaffTodoCapture(todo, payload).ok;
}

export function displayTodoShowsCaptureFields(
  captureType: StaffTodoCaptureType,
): boolean {
  return staffTodoNeedsCaptureInput(captureType) && captureType !== "boolean";
}

export function DisplayTodoCaptureFields({
  captureType,
  limits,
  limitsLabel,
  values,
  onChange,
  showCorrective,
  large = true,
}: DisplayTodoCaptureFieldsProps) {
  const inputClass = cn(large ? "h-12 rounded-xl text-base md:h-11 md:text-sm" : "rounded-xl");

  if (captureType === "none" || captureType === "boolean") return null;

  return (
    <div className="space-y-4">
      {captureType === "temperature" || captureType === "number" ? (
        <div className="space-y-1.5">
          <Label htmlFor="display-capture-numeric">
            {captureType === "temperature" ? "Temperatur (°C)" : "Wert"}
          </Label>
          <Input
            id="display-capture-numeric"
            type="number"
            inputMode="decimal"
            step="0.1"
            value={values.numeric}
            onChange={(e) => onChange({ ...values, numeric: e.target.value })}
            placeholder={captureType === "temperature" ? "z. B. 4,2" : "Zahl"}
            className={cn(inputClass, "tabular-nums")}
          />
          {limitsLabel ? (
            <p className="text-xs text-muted-foreground">Soll: {limitsLabel}</p>
          ) : limits.min != null || limits.max != null ? (
            <p className="text-xs text-muted-foreground">
              Soll:{" "}
              {limits.min != null && limits.max != null
                ? `${limits.min} – ${limits.max}`
                : limits.max != null
                  ? `max. ${limits.max}`
                  : `min. ${limits.min}`}
              {captureType === "temperature" ? " °C" : ""}
            </p>
          ) : null}
        </div>
      ) : null}

      {captureType === "text" ? (
        <div className="space-y-1.5">
          <Label htmlFor="display-capture-text">Eingabe</Label>
          <Input
            id="display-capture-text"
            value={values.text}
            onChange={(e) => onChange({ ...values, text: e.target.value })}
            className={inputClass}
          />
        </div>
      ) : null}

      {showCorrective ? (
        <div className="space-y-1.5">
          <Label htmlFor="display-capture-corrective">Korrekturmaßnahme *</Label>
          <Textarea
            id="display-capture-corrective"
            value={values.corrective}
            onChange={(e) =>
              onChange({ ...values, corrective: e.target.value })
            }
            rows={2}
            className="rounded-xl"
            placeholder="Was wurde unternommen?"
          />
        </div>
      ) : null}
    </div>
  );
}

export function buildStaffTodoLimitsLabel(
  todo: Pick<
    {
      capture_type: StaffTodoCaptureType;
      target_min: number | null;
      target_max: number | null;
    },
    "capture_type" | "target_min" | "target_max"
  >,
): string | null {
  return staffTodoLimitsLabel(todo);
}
