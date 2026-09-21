/** iOS-PWA: WKWebView friert ein und bricht Fetches ab — Catch läuft oft erst beim Wiederöffnen. */
export const CLIENT_SEND_ABORTED = "client_aborted";

const RESUME_SILENCE_MS = 8_000;

let lastHiddenAt = 0;
let lastVisibleAt = 0;
let listenerBound = false;

function ensureVisibilityTracking(): void {
  if (listenerBound || typeof document === "undefined") return;
  listenerBound = true;
  if (document.visibilityState === "hidden") {
    lastHiddenAt = Date.now();
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      lastHiddenAt = Date.now();
      return;
    }
    lastVisibleAt = Date.now();
  });
}

function messageFromUnknown(reason: unknown): string {
  if (reason instanceof Error) return reason.message;
  if (typeof reason === "string") return reason;
  if (typeof reason === "object" && reason !== null && "message" in reason) {
    const m = (reason as { message: unknown }).message;
    if (typeof m === "string") return m;
  }
  return "";
}

function nameFromUnknown(reason: unknown): string {
  if (reason instanceof Error) return reason.name;
  if (typeof reason === "object" && reason !== null && "name" in reason) {
    const n = (reason as { name: unknown }).name;
    if (typeof n === "string") return n;
  }
  return "";
}

export function isAbortLikeFailure(reason: unknown): boolean {
  const name = nameFromUnknown(reason);
  if (name === "AbortError" || name === "TimeoutError") return true;
  return /the operation was aborted|aborterror/i.test(messageFromUnknown(reason));
}

export function isTransientBrowserNetworkFailure(reason: unknown): boolean {
  if (isAbortLikeFailure(reason)) return true;
  const name = nameFromUnknown(reason);
  const msg = messageFromUnknown(reason);
  if (name === "TypeError" && /load failed|failed to fetch|networkerror|cancelled/i.test(msg)) {
    return true;
  }
  // String(TypeError) → „TypeError: Load failed“
  if (/^typeerror:\s*load failed/i.test(msg.trim())) return true;
  return /load failed|failed to fetch|networkerror|network request failed/i.test(msg);
}

function isBackgroundedOrRecentlyResumed(): boolean {
  ensureVisibilityTracking();
  if (typeof document === "undefined") return false;
  if (document.visibilityState === "hidden") return true;
  if (lastHiddenAt <= 0) return false;
  return lastVisibleAt > 0 && Date.now() - lastVisibleAt < RESUME_SILENCE_MS;
}

export function isAppBackgroundedOrRecentlyResumed(): boolean {
  return isBackgroundedOrRecentlyResumed();
}

/**
 * Kein Fehler-Toast: Request abgebrochen (Navigation) oder transienter Browser-Netzwerkfehler
 * (Safari „Load failed“ / Failed to fetch) — oft Keep-alive / Tab-Resume, nie nutzbar.
 */
export function shouldSilenceClientSendFailure(reason: unknown): boolean {
  if (isAbortLikeFailure(reason)) return true;
  // Transient network: immer stumm (nicht nur nach Background-Resume).
  if (isTransientBrowserNetworkFailure(reason)) return true;
  return false;
}

export function isSilentClientSendResult(result: {
  error?: string;
  skipped?: string;
} | null | undefined): boolean {
  return (
    result?.error === CLIENT_SEND_ABORTED ||
    result?.skipped === CLIENT_SEND_ABORTED
  );
}
