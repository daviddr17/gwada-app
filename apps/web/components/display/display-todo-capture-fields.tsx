"use client";

import { useId, type RefObject } from "react";
import { AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { RestaurantStaffTodoRow, StaffTodoCaptureType } from "@/lib/types/staff-todos";
import { staffTodoLimitsLabel } from "@/lib/staff/staff-todo-meta";
import type { StaffTodoCaptureLimits } from "@/lib/staff/staff-todo-capture";
import {
  evaluateStaffTodoCapture,
  numericCaptureHasDeviation,
  parseCapturedNumeric,
  resolveEffectiveCaptureType,
  staffTodoNeedsCaptureInput,
  staffTodoCaptureLimitsDefined,
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

export type DisplayTodoCaptureTodoLike = Pick<
  RestaurantStaffTodoRow,
  | "capture_type"
  | "target_min"
  | "target_max"
  | "checklist_device"
  | "require_corrective_on_deviation"
>;

type DisplayTodoCaptureFieldsProps = {
  captureType: StaffTodoCaptureType;
  limits: StaffTodoCaptureLimits;
  limitsLabel?: string | null;
  values: DisplayTodoCaptureState;
  onChange: (next: DisplayTodoCaptureState) => void;
  /** Korrekturmaßnahme bei Abweichung verlangen (typisch: Sollbereich definiert). */
  correctiveRequired?: boolean;
  large?: boolean;
  /** Display / Tablet: großes Zahlenfeld, Zifferntastatur. */
  variant?: "default" | "display";
  autoFocus?: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
};

function sanitizeNumericInput(raw: string): string {
  let next = raw.replace(/[^\d,.-]/g, "");
  const firstSep = next.search(/[,.]/);
  if (firstSep >= 0) {
    const head = next.slice(0, firstSep + 1);
    const tail = next.slice(firstSep + 1).replace(/[,.]/g, "");
    next = head + tail;
  }
  return next;
}

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

export function effectiveCaptureTypeForTodo(
  todo: DisplayTodoCaptureTodoLike,
): StaffTodoCaptureType {
  return resolveEffectiveCaptureType(todo);
}

export function displayTodoShowsCaptureFields(
  captureType: StaffTodoCaptureType,
): boolean {
  return staffTodoNeedsCaptureInput(captureType) && captureType !== "boolean";
}

export function displayTodoShowsCaptureFieldsForTodo(
  todo: DisplayTodoCaptureTodoLike,
): boolean {
  return displayTodoShowsCaptureFields(resolveEffectiveCaptureType(todo));
}

export function displayTodoCapturePayloadForTodo(
  todo: DisplayTodoCaptureTodoLike,
  values: DisplayTodoCaptureState,
) {
  return displayTodoCapturePayloadForComplete(
    resolveEffectiveCaptureType(todo),
    values,
  );
}

export function displayTodoCaptureReadyForComplete(
  todo: DisplayTodoCaptureTodoLike,
  values: DisplayTodoCaptureState,
): boolean {
  const captureType = resolveEffectiveCaptureType(todo);
  if (captureType === "boolean") return true;
  if (!staffTodoNeedsCaptureInput(captureType)) return true;
  const payload = displayTodoCapturePayloadFromState(captureType, values);
  return evaluateStaffTodoCapture(todo, payload).ok;
}

export function DisplayTodoCaptureFields({
  captureType,
  limits,
  limitsLabel,
  values,
  onChange,
  correctiveRequired = false,
  large = true,
  variant = "default",
  autoFocus = false,
  inputRef,
}: DisplayTodoCaptureFieldsProps) {
  const numericId = useId();
  const textId = useId();
  const correctiveId = useId();
  const isDisplay = variant === "display";

  const inputClass = cn(
    large ? "h-12 rounded-xl text-base md:h-11 md:text-sm" : "rounded-xl",
    isDisplay &&
      "h-16 rounded-2xl border-2 border-accent/35 bg-background text-center text-3xl font-semibold tracking-tight shadow-sm focus-visible:border-accent focus-visible:ring-accent/30 md:h-16 md:text-3xl",
  );

  if (captureType === "none" || captureType === "boolean") return null;

  const parsedNumeric = parseCapturedNumeric(values.numeric);
  const hasDeviation = numericCaptureHasDeviation(parsedNumeric, limits);
  const showCorrectiveField = hasDeviation && correctiveRequired;

  const limitsHint =
    limitsLabel ??
    (limits.min != null || limits.max != null
      ? captureType === "temperature"
        ? limits.min != null && limits.max != null
          ? `${limits.min} – ${limits.max} °C`
          : limits.max != null
            ? `max. ${limits.max} °C`
            : `min. ${limits.min} °C`
        : limits.min != null && limits.max != null
          ? `${limits.min} – ${limits.max}`
          : limits.max != null
            ? `max. ${limits.max}`
            : `min. ${limits.min}`
      : null);

  return (
    <div className={cn("space-y-4", isDisplay && "space-y-3")}>
      {captureType === "temperature" || captureType === "number" ? (
        <div
          className={cn(
            "space-y-2",
            isDisplay &&
              "rounded-2xl border p-4",
            isDisplay && hasDeviation
              ? "border-amber-500/40 bg-amber-500/5"
              : isDisplay && "border-accent/25 bg-accent/5",
          )}
        >
          <Label
            htmlFor={numericId}
            className={cn(
              isDisplay && "text-base font-semibold text-foreground",
            )}
          >
            {captureType === "temperature" ? "Temperatur messen" : "Wert eintragen"}
          </Label>
          <div className="relative">
            <Input
              ref={inputRef}
              id={numericId}
              type="text"
              inputMode={captureType === "temperature" ? "decimal" : "numeric"}
              autoComplete="off"
              autoFocus={autoFocus}
              enterKeyHint="done"
              value={values.numeric}
              onChange={(e) =>
                onChange({
                  ...values,
                  numeric: sanitizeNumericInput(e.target.value),
                })
              }
              placeholder={captureType === "temperature" ? "0,0" : "0"}
              className={cn(
                inputClass,
                "tabular-nums",
                isDisplay && "pr-14",
                hasDeviation &&
                  "border-amber-500/50 focus-visible:border-amber-500 focus-visible:ring-amber-500/30",
              )}
            />
            {captureType === "temperature" ? (
              <span
                className={cn(
                  "pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground",
                  isDisplay
                    ? "right-5 text-xl font-medium"
                    : "right-3 text-sm",
                )}
                aria-hidden
              >
                °C
              </span>
            ) : null}
          </div>
          {limitsHint ? (
            <p
              className={cn(
                "text-muted-foreground",
                isDisplay ? "text-sm font-medium" : "text-xs",
              )}
            >
              Sollbereich: {limitsHint}
            </p>
          ) : null}
          {hasDeviation && staffTodoCaptureLimitsDefined(limits) ? (
            <p
              className={cn(
                "flex items-start gap-2 font-medium text-amber-800 dark:text-amber-300",
                isDisplay ? "text-sm" : "text-xs",
              )}
              role="alert"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                Außerhalb des Sollbereichs
                {limitsHint ? ` (${limitsHint})` : ""}.
                {correctiveRequired
                  ? " Bitte Korrekturmaßnahme eintragen, bevor Sie erledigen."
                  : null}
              </span>
            </p>
          ) : null}
        </div>
      ) : null}

      {captureType === "text" ? (
        <div className="space-y-1.5">
          <Label htmlFor={textId}>Eingabe</Label>
          <Input
            ref={inputRef}
            id={textId}
            value={values.text}
            onChange={(e) => onChange({ ...values, text: e.target.value })}
            autoFocus={autoFocus}
            className={inputClass}
          />
        </div>
      ) : null}

      {showCorrectiveField ? (
        <div className="space-y-1.5">
          <Label htmlFor={correctiveId}>Korrekturmaßnahme *</Label>
          <Textarea
            id={correctiveId}
            value={values.corrective}
            onChange={(e) =>
              onChange({ ...values, corrective: e.target.value })
            }
            rows={isDisplay ? 3 : 2}
            className="rounded-xl"
            placeholder="Was wurde unternommen? Grund der Abweichung …"
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
      checklist_device?: RestaurantStaffTodoRow["checklist_device"];
    },
    "capture_type" | "target_min" | "target_max" | "checklist_device"
  >,
): string | null {
  const effective = resolveEffectiveCaptureType(todo);
  if (effective !== "temperature" && effective !== "number") return null;
  return staffTodoLimitsLabel({ ...todo, capture_type: effective });
}
