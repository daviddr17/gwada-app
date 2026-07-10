import { AUTH_EMAIL_FETCH_TIMEOUT_MS } from "@/lib/supabase/race-timeout";

/** Fetch-Abort für Auth-Mail — Fallback wenn `AbortSignal.timeout` fehlt (ältere Safari). */
export function createAuthEmailFetchSignal(): AbortSignal {
  if (typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(AUTH_EMAIL_FETCH_TIMEOUT_MS);
  }
  const controller = new AbortController();
  setTimeout(() => controller.abort(), AUTH_EMAIL_FETCH_TIMEOUT_MS);
  return controller.signal;
}
