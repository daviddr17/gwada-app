/** Meldung aus beliebigem rejection / Fehler-Objekt (Safari: TypeError „Load failed“). */
function messageFromUnknown(reason: unknown): string {
  if (reason instanceof Error) return reason.message;
  if (typeof reason === "string") return reason;
  if (typeof reason === "object" && reason !== null && "message" in reason) {
    const m = (reason as { message: unknown }).message;
    if (typeof m === "string") return m;
  }
  try {
    return String(reason);
  } catch {
    return "";
  }
}

function nameFromUnknown(reason: unknown): string {
  if (reason instanceof Error) return reason.name;
  if (typeof reason === "object" && reason !== null && "name" in reason) {
    const n = (reason as { name: unknown }).name;
    if (typeof n === "string") return n;
  }
  return "";
}

/**
 * Typische Supabase-GoTrue-Netzwerkfehler (offline, CORS, DNS) — keine App-Logikfehler.
 * Verhindert „unhandledrejection“-Spam und Next-Dev-Overlays für erwartbare Fälle.
 */
export function isExpectedSupabaseAuthNetworkFailure(reason: unknown): boolean {
  const name = nameFromUnknown(reason);
  if (name === "AuthRetryableFetchError") return true;
  const msg = messageFromUnknown(reason);
  if (name === "TypeError" && /load failed/i.test(msg)) return true;
  return /authretryablefetcherror|load failed|failed to fetch|networkerror|network request failed/i.test(
    msg,
  );
}

/** Filter für `console.error`-Aufrufe von GoTrue bei gleichen Netzwerkproblemen. */
export function shouldSuppressExpectedSupabaseConsoleArgs(
  args: unknown[],
): boolean {
  for (const a of args) {
    if (a instanceof Error) {
      if (a.name === "AuthRetryableFetchError") return true;
      if (a.name === "TypeError" && /load failed/i.test(a.message)) return true;
    }
    if (
      typeof a === "string" &&
      /authretryablefetcherror|load failed|failed to fetch/i.test(a)
    ) {
      return true;
    }
  }
  return false;
}
