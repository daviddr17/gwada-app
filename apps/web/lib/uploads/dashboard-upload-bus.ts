import {
  DISPLAY_CELEBRATION_EXIT_MS,
  DISPLAY_CELEBRATION_EXIT_REDUCED_MS,
  DISPLAY_CELEBRATION_HOLD_MS,
  DISPLAY_CELEBRATION_HOLD_REDUCED_MS,
} from "@/lib/ui/motion-presets";

export type DashboardUploadPhase = "idle" | "uploading" | "success";

export type DashboardUploadState = {
  phase: DashboardUploadPhase;
  progress: number;
  message: string;
  successMessage: string;
  /** @deprecated Nutze `phase !== "idle"`. */
  active: boolean;
};

type UploadStateListener = (state: DashboardUploadState) => void;

type FinishUploadOptions = {
  success: boolean;
  successMessage?: string;
};

let activeUploadCount = 0;
let phase: DashboardUploadPhase = "idle";
let progress = 0;
let message = "Wird hochgeladen …";
let successMessage = "";
let progressTimer: ReturnType<typeof setInterval> | null = null;
let overlayStartedAt = 0;

const MIN_OVERLAY_VISIBLE_MS = 700;
const UPLOAD_FAIL_DISMISS_MS = 280;

const listeners = new Set<UploadStateListener>();

function currentState(): DashboardUploadState {
  return {
    phase,
    progress,
    message,
    successMessage,
    active: phase !== "idle",
  };
}

function notifyState() {
  const state = currentState();
  for (const listener of listeners) {
    listener(state);
  }
}

function clearProgressTimer() {
  if (progressTimer) {
    clearInterval(progressTimer);
    progressTimer = null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function startProgressSimulation() {
  clearProgressTimer();
  progress = 0;
  notifyState();

  progressTimer = setInterval(() => {
    if (progress >= 92) return;
    const remaining = 92 - progress;
    progress += Math.max(0.35, remaining * 0.07);
    notifyState();
  }, 70);
}

function beginUploadOverlay() {
  overlayStartedAt = Date.now();
  phase = "uploading";
  successMessage = "";
  startProgressSimulation();
  notifyState();
}

function resetUploadOverlay() {
  clearProgressTimer();
  phase = "idle";
  progress = 0;
  successMessage = "";
  message = "Wird hochgeladen …";
  notifyState();
}

async function finishUploadOverlay(options: FinishUploadOptions) {
  const elapsed = Date.now() - overlayStartedAt;
  const remaining = MIN_OVERLAY_VISIBLE_MS - elapsed;
  if (remaining > 0) {
    await sleep(remaining);
  }

  clearProgressTimer();

  const celebrate =
    options.success && Boolean(options.successMessage?.trim());

  if (!celebrate) {
    if (options.success) {
      progress = 100;
      notifyState();
      await sleep(UPLOAD_FAIL_DISMISS_MS);
    }
    resetUploadOverlay();
    return;
  }

  progress = 100;
  successMessage = options.successMessage!.trim();
  phase = "success";
  notifyState();

  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const holdMs = reduceMotion
    ? DISPLAY_CELEBRATION_HOLD_REDUCED_MS
    : DISPLAY_CELEBRATION_HOLD_MS;
  const exitMs = reduceMotion
    ? DISPLAY_CELEBRATION_EXIT_REDUCED_MS
    : DISPLAY_CELEBRATION_EXIT_MS;

  await sleep(holdMs + exitMs);
  resetUploadOverlay();
}

export function subscribeDashboardUploadState(
  listener: UploadStateListener,
): () => void {
  listeners.add(listener);
  listener(currentState());
  return () => {
    listeners.delete(listener);
  };
}

/** @deprecated Prefer subscribeDashboardUploadState */
export function subscribeDashboardUploadActive(
  listener: (active: boolean) => void,
): () => void {
  return subscribeDashboardUploadState((state) => listener(state.active));
}

export async function withDashboardUploadTracking<T>(
  task: () => Promise<T>,
  options?: {
    message?: string;
    successMessage?: string;
    isSuccess?: (result: T) => boolean;
  },
): Promise<T> {
  const wasIdle = activeUploadCount === 0;
  if (wasIdle && options?.message?.trim()) {
    message = options.message.trim();
  }
  activeUploadCount += 1;
  if (wasIdle) {
    beginUploadOverlay();
  }

  let succeeded = true;
  try {
    const result = await task();
    if (options?.isSuccess) {
      succeeded = options.isSuccess(result);
    }
    return result;
  } catch (error) {
    succeeded = false;
    throw error;
  } finally {
    activeUploadCount = Math.max(0, activeUploadCount - 1);
    if (activeUploadCount === 0 && phase !== "idle") {
      await finishUploadOverlay({
        success: succeeded,
        successMessage: options?.successMessage,
      });
    }
  }
}
