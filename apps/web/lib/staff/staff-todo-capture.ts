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

export function resolveStaffTodoCaptureLimits(
  todo: Pick<
    RestaurantStaffTodoRow,
    "capture_type" | "target_min" | "target_max" | "checklist_device"
  >,
): StaffTodoCaptureLimits {
  const device = todo.checklist_device;
  if (
    todo.capture_type === "temperature" ||
    todo.capture_type === "number"
  ) {
    return {
      min: todo.target_min ?? device?.target_min ?? null,
      max: todo.target_max ?? device?.target_max ?? null,
    };
  }
  return { min: null, max: null };
}

function numericWithinLimits(
  value: number,
  limits: StaffTodoCaptureLimits,
): boolean {
  if (limits.min != null && value < limits.min) return false;
  if (limits.max != null && value > limits.max) return false;
  return true;
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
  const captureType = todo.capture_type ?? "none";
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
  if (hasDeviation && todo.require_corrective_on_deviation && !corrective) {
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
