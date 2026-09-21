/** Externe Google-/Meta-Calls dürfen die Öffnungszeiten-UI nicht endlos blockieren. */
export const PLATFORM_HOURS_FETCH_TIMEOUT_MS = 12_000;
export const PLATFORM_OAUTH_REFRESH_TIMEOUT_MS = 10_000;
export const PLATFORM_HOURS_STATUS_CLIENT_TIMEOUT_MS = 20_000;

export function platformApiFetchSignal(
  timeoutMs: number = PLATFORM_HOURS_FETCH_TIMEOUT_MS,
): AbortSignal {
  if (typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(timeoutMs);
  }
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);
  return controller.signal;
}
