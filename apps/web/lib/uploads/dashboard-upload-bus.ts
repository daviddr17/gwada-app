export type DashboardUploadState = {
  active: boolean;
  progress: number;
  message: string;
};

type UploadStateListener = (state: DashboardUploadState) => void;

let activeUploadCount = 0;
let visible = false;
let progress = 0;
let message = "Wird hochgeladen …";
let progressTimer: ReturnType<typeof setInterval> | null = null;
let settleTimer: ReturnType<typeof setTimeout> | null = null;
let overlayStartedAt = 0;

const MIN_OVERLAY_VISIBLE_MS = 700;

const listeners = new Set<UploadStateListener>();

function currentState(): DashboardUploadState {
  return { active: visible, progress, message };
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

function clearSettleTimer() {
  if (settleTimer) {
    clearTimeout(settleTimer);
    settleTimer = null;
  }
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
  clearSettleTimer();
  overlayStartedAt = Date.now();
  visible = true;
  startProgressSimulation();
  notifyState();
}

async function finishUploadOverlay() {
  const elapsed = Date.now() - overlayStartedAt;
  const remaining = MIN_OVERLAY_VISIBLE_MS - elapsed;
  if (remaining > 0) {
    await new Promise((resolve) => setTimeout(resolve, remaining));
  }

  clearProgressTimer();
  progress = 100;
  notifyState();

  clearSettleTimer();
  settleTimer = setTimeout(() => {
    visible = false;
    progress = 0;
    notifyState();
  }, 420);
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
export function subscribeDashboardUploadActive(listener: (active: boolean) => void): () => void {
  return subscribeDashboardUploadState((state) => listener(state.active));
}

export async function withDashboardUploadTracking<T>(
  task: () => Promise<T>,
  options?: { message?: string },
): Promise<T> {
  const wasIdle = activeUploadCount === 0;
  if (wasIdle && options?.message?.trim()) {
    message = options.message.trim();
  }
  activeUploadCount += 1;
  if (wasIdle) {
    beginUploadOverlay();
  }

  try {
    return await task();
  } finally {
    activeUploadCount = Math.max(0, activeUploadCount - 1);
    if (activeUploadCount === 0 && visible) {
      await finishUploadOverlay();
      message = "Wird hochgeladen …";
    }
  }
}
