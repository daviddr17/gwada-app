import type { StaffTodoDisplayUrgency } from "@/lib/staff/staff-todo-status";

/** Display-ToDo-Badge nach Live-Hinweis (Polling) aktualisieren. */
export const GWADA_DISPLAY_TODOS_REFRESH_EVENT = "gwada:display-todos-refresh";

/** Sofort-Check nach PIN-Anmeldung / Entsperren. */
export const GWADA_DISPLAY_TODOS_LIVE_SYNC_EVENT = "gwada:display-todos-live-sync";

/** Badge-Zähler sofort setzen (ohne auf Fetch zu warten). */
export const GWADA_DISPLAY_TODOS_BADGE_SNAPSHOT_EVENT =
  "gwada:display-todos-badge-snapshot";

export type DisplayTodoBadgeSnapshot = {
  badge_count: number;
  badge_urgency: StaffTodoDisplayUrgency;
  /** Nach Complete/Defer: verzögerte Refreshes dürfen den Zähler nicht erhöhen. */
  guardRefresh?: boolean;
};

export function dispatchDisplayTodosRefresh(): void {
  window.dispatchEvent(new Event(GWADA_DISPLAY_TODOS_REFRESH_EVENT));
}

export function dispatchDisplayTodoBadgeSnapshot(
  snapshot: DisplayTodoBadgeSnapshot,
): void {
  window.dispatchEvent(
    new CustomEvent<DisplayTodoBadgeSnapshot>(
      GWADA_DISPLAY_TODOS_BADGE_SNAPSHOT_EVENT,
      { detail: snapshot },
    ),
  );
}

export function syncDisplayTodosLiveAfterPin(): void {
  dispatchDisplayTodosRefresh();
  window.dispatchEvent(new Event(GWADA_DISPLAY_TODOS_LIVE_SYNC_EVENT));
}
