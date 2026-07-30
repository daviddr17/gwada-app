import { QueryClient, focusManager } from "@tanstack/react-query";

/**
 * Nach Tab-Rückkehr: erst Klicks/Paint, dann Refetch-Burst.
 * visibilitychange + focus werden zu einem Lauf zusammengeführt.
 */
const FOCUS_REFETCH_MIN_DELAY_MS = 600;
const FOCUS_REFETCH_IDLE_TIMEOUT_MS = 2_500;

/** Standard-SWR: Modulwechsel zeigt Cache sofort, Refetch nur wenn stale. */
const DEFAULT_QUERY_STALE_MS = 60_000;
const DEFAULT_QUERY_GC_MS = 30 * 60_000;

let focusListenerConfigured = false;

function configureDeferredFocusRefetch(): void {
  if (focusListenerConfigured || typeof window === "undefined") return;
  focusListenerConfigured = true;

  focusManager.setEventListener((handleFocus) => {
    let delayTimer: number | null = null;
    let idleId: number | null = null;

    const clearPending = () => {
      if (delayTimer != null) {
        window.clearTimeout(delayTimer);
        delayTimer = null;
      }
      if (idleId != null && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
        idleId = null;
      }
    };

    const runFocusedTrue = () => {
      delayTimer = null;
      idleId = null;
      // Boolean → setFocused nur bei Wechsel (kein Doppel-Refetch).
      handleFocus(true);
    };

    const scheduleVisibleFocus = () => {
      // visibilitychange + window focus → ein einziger deferred Lauf.
      if (delayTimer != null || idleId != null) return;

      delayTimer = window.setTimeout(() => {
        delayTimer = null;
        if (document.visibilityState !== "visible") return;

        if ("requestIdleCallback" in window) {
          idleId = window.requestIdleCallback(runFocusedTrue, {
            timeout: FOCUS_REFETCH_IDLE_TIMEOUT_MS,
          });
          return;
        }
        runFocusedTrue();
      }, FOCUS_REFETCH_MIN_DELAY_MS);
    };

    const onVisibilityOrFocus = () => {
      if (document.visibilityState !== "visible") {
        clearPending();
        // Explizit unfocused — sonst bleibt der Manager „true“ und Resume ist wirkungslos.
        handleFocus(false);
        return;
      }
      scheduleVisibleFocus();
    };

    document.addEventListener("visibilitychange", onVisibilityOrFocus, false);
    window.addEventListener("focus", onVisibilityOrFocus, false);

    return () => {
      clearPending();
      document.removeEventListener("visibilitychange", onVisibilityOrFocus);
      window.removeEventListener("focus", onVisibilityOrFocus);
    };
  });
}

/** Web-App QueryClient — SWR-first für flüssige Modul-Navigation. */
export function createAppQueryClient(): QueryClient {
  configureDeferredFocusRefetch();

  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        staleTime: DEFAULT_QUERY_STALE_MS,
        gcTime: DEFAULT_QUERY_GC_MS,
        /** Kein Mount-Refetch-Sturm — Realtime/Poll/Fokus aktualisieren bei Bedarf. */
        refetchOnMount: false,
      },
    },
  });
}
