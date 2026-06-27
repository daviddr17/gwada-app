import type {
  RestaurantStaffTodoRow,
  StaffTodoCaptureType,
} from "@/lib/types/staff-todos";

export type StaffTodoCapturePayload = {
  captured_numeric?: number | null;
  captured_text?: string | null;
  captured_boolean?: boolean | null;
  corrective_action?: string | null;
};

export type StaffTodoCaptureLimits = {
  min: number | null;
  max: number | null;
};

/** Display: Temperatur/Zahl auch bei veraltetem boolean + Geräte-Sollwerten. */
export function resolveEffectiveCaptureType(
  todo: Pick<
    RestaurantStaffTodoRow,
    "capture_type" | "target_min" | "target_max" | "checklist_device"
  >,
): StaffTodoCaptureType {
  const type = todo.capture_type ?? "none";
  if (type === "temperature" || type === "number" || type === "text") {
    return type;
  }
  const device = todo.checklist_device;
  const hasNumericLimits =
    todo.target_min != null ||
    todo.target_max != null ||
    device?.target_min != null ||
    device?.target_max != null;
  if (hasNumericLimits) return "temperature";
  return type;
}

export function resolveStaffTodoCaptureLimits(
  todo: Pick<
    RestaurantStaffTodoRow,
    "capture_type" | "target_min" | "target_max" | "checklist_device"
  >,
): StaffTodoCaptureLimits {
  const effective = resolveEffectiveCaptureType(todo);
  if (effective !== "temperature" && effective !== "number") {
    return { min: null, max: null };
  }
  const device = todo.checklist_device;
  return {
    min: todo.target_min ?? device?.target_min ?? null,
    max: todo.target_max ?? device?.target_max ?? null,
  };
}

function numericWithinLimits(
  value: number,
  limits: StaffTodoCaptureLimits,
): boolean {
  if (limits.min != null && value < limits.min) return false;
  if (limits.max != null && value > limits.max) return false;
  return true;
}

export function staffTodoCaptureLimitsDefined(
  limits: StaffTodoCaptureLimits,
): boolean {
  return limits.min != null || limits.max != null;
}

export function parseCapturedNumeric(raw: string): number | null {
  const numericRaw = raw.trim().replace(",", ".");
  if (numericRaw === "") return null;
  const n = Number.parseFloat(numericRaw);
  return Number.isNaN(n) ? null : n;
}

export function numericCaptureHasDeviation(
  value: number | null,
  limits: StaffTodoCaptureLimits,
): boolean {
  if (value == null || !staffTodoCaptureLimitsDefined(limits)) return false;
  return !numericWithinLimits(value, limits);
}

/** Abweichung vom Sollbereich → Korrekturmaßnahme, wenn Flag gesetzt oder Limits definiert. */
export function captureRequiresCorrectiveOnDeviation(
  todo: Pick<RestaurantStaffTodoRow, "require_corrective_on_deviation">,
  limits: StaffTodoCaptureLimits,
): boolean {
  return (
    todo.require_corrective_on_deviation || staffTodoCaptureLimitsDefined(limits)
  );
}

export type StaffTodoCaptureEvaluation = {
  ok: boolean;
  error?: string;
  within_limits: boolean | null;
  has_deviation: boolean;
  captured_numeric: number | null;
  captured_text: string | null;
  corrective_action: string | null;
};

export function evaluateStaffTodoCapture(
  todo: Pick<
    RestaurantStaffTodoRow,
    | "capture_type"
    | "target_min"
    | "target_max"
    | "checklist_device"
    | "require_corrective_on_deviation"
  >,
  payload: StaffTodoCapturePayload,
): StaffTodoCaptureEvaluation {
  const captureType = resolveEffectiveCaptureType(todo);
  const limits = resolveStaffTodoCaptureLimits(todo);
  const corrective = payload.corrective_action?.trim() || null;

  if (captureType === "none") {
    return {
      ok: true,
      within_limits: null,
      has_deviation: false,
      captured_numeric: null,
      captured_text: null,
      corrective_action: null,
    };
  }

  if (captureType === "boolean") {
    if (payload.captured_boolean !== true) {
      return {
        ok: false,
        error: "capture_required",
        within_limits: null,
        has_deviation: false,
        captured_numeric: null,
        captured_text: null,
        corrective_action: null,
      };
    }
    return {
      ok: true,
      within_limits: true,
      has_deviation: false,
      captured_numeric: null,
      captured_text: null,
      corrective_action: null,
    };
  }

  if (captureType === "text") {
    const text = payload.captured_text?.trim() ?? "";
    if (!text) {
      return {
        ok: false,
        error: "capture_required",
        within_limits: null,
        has_deviation: false,
        captured_numeric: null,
        captured_text: null,
        corrective_action: null,
      };
    }
    return {
      ok: true,
      within_limits: null,
      has_deviation: false,
      captured_numeric: null,
      captured_text: text,
      corrective_action: null,
    };
  }

  const raw = payload.captured_numeric;
  if (raw == null || Number.isNaN(raw)) {
    return {
      ok: false,
      error: "capture_required",
      within_limits: null,
      has_deviation: false,
      captured_numeric: null,
      captured_text: null,
      corrective_action: null,
    };
  }

  const within = numericWithinLimits(raw, limits);
  const hasDeviation = !within;
  if (
    hasDeviation &&
    captureRequiresCorrectiveOnDeviation(todo, limits) &&
    !corrective
  ) {
    return {
      ok: false,
      error: "corrective_action_required",
      within_limits: false,
      has_deviation: true,
      captured_numeric: raw,
      captured_text: null,
      corrective_action: null,
    };
  }

  return {
    ok: true,
    within_limits: within,
    has_deviation: hasDeviation,
    captured_numeric: raw,
    captured_text: null,
    corrective_action: corrective,
  };
}

export function staffTodoNeedsCaptureInput(
  captureType: StaffTodoCaptureType | null | undefined,
): boolean {
  return Boolean(captureType && captureType !== "none");
}
