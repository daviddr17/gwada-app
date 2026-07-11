import { QueryClient, focusManager } from "@tanstack/react-query";

/** Kurz nach Tab-Fokus — Klicks/Navigation vor dem Refetch-Burst. */
const FOCUS_REFETCH_DEFER_MS = 280;

/** Standard-SWR: Modulwechsel zeigt Cache sofort, Refetch nur wenn stale. */
const DEFAULT_QUERY_STALE_MS = 60_000;
const DEFAULT_QUERY_GC_MS = 30 * 60_000;

let focusListenerConfigured = false;

function configureDeferredFocusRefetch(): void {
  if (focusListenerConfigured || typeof window === "undefined") return;
  focusListenerConfigured = true;

  focusManager.setEventListener((handleFocus) => {
    const onFocus = () => {
      if (document.visibilityState !== "visible") return;
      window.setTimeout(handleFocus, FOCUS_REFETCH_DEFER_MS);
    };

    window.addEventListener("visibilitychange", onFocus, false);
    window.addEventListener("focus", onFocus, false);

    return () => {
      window.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
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
