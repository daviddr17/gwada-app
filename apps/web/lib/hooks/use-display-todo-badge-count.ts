"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  GWADA_DISPLAY_TODOS_BADGE_SNAPSHOT_EVENT,
  GWADA_DISPLAY_TODOS_REFRESH_EVENT,
  type DisplayTodoBadgeSnapshot,
} from "@/lib/display/display-todos-live-events";
import { handleDisplaySessionAuthFailure } from "@/lib/display/display-session-client";
import type { StaffTodoDisplayUrgency } from "@/lib/staff/staff-todo-status";

/** Nach Complete/Defer: veraltete Server-Zähler nicht übernehmen (60 s). */
const SNAPSHOT_GUARD_MS = 60_000;

export function useDisplayTodoBadgeCount(enabled: boolean): {
  count: number;
  urgency: StaffTodoDisplayUrgency;
  refresh: () => Promise<void>;
} {
  const [count, setCount] = useState(0);
  const [urgency, setUrgency] = useState<StaffTodoDisplayUrgency>("green");
  const snapshotGuardRef = useRef<{ until: number; maxCount: number } | null>(
    null,
  );

  const applySnapshot = useCallback(
    (
      snapshot: DisplayTodoBadgeSnapshot,
      opts?: { fromUserAction?: boolean },
    ) => {
      const guard = snapshotGuardRef.current;
      if (
        guard &&
        Date.now() < guard.until &&
        snapshot.badge_count > guard.maxCount
      ) {
        return;
      }
      if (guard && Date.now() >= guard.until) {
        snapshotGuardRef.current = null;
      }
      if (opts?.fromUserAction) {
        snapshotGuardRef.current = {
          until: Date.now() + SNAPSHOT_GUARD_MS,
          maxCount: snapshot.badge_count,
        };
      }
      setCount(snapshot.badge_count);
      setUrgency(snapshot.badge_urgency);
    },
    [],
  );

  const refresh = useCallback(async () => {
    if (!enabled) {
      setCount(0);
      setUrgency("green");
      snapshotGuardRef.current = null;
      return;
    }
    try {
      const res = await fetch("/api/display/todos?badge_only=1", {
        cache: "no-store",
        credentials: "include",
      });
      if (!res.ok) {
        // Abgelaufene PIN-Session → zurück zum PIN, kein „Checklisten“-Toast
        if (await handleDisplaySessionAuthFailure(res)) return;
        if (res.status >= 500) return;
        toast.error("Checklisten konnten nicht geladen werden.");
        return;
      }
      const data = (await res.json()) as {
        badge_count?: number;
        badge_urgency?: StaffTodoDisplayUrgency;
      };
      applySnapshot({
        badge_count: data.badge_count ?? 0,
        badge_urgency: data.badge_urgency ?? "green",
      });
    } catch {
      /* ignore */
    }
  }, [enabled, applySnapshot]);

  useEffect(() => {
    void refresh();
    const onRefresh = () => void refresh();
    const onSnapshot = (event: Event) => {
      const detail = (event as CustomEvent<DisplayTodoBadgeSnapshot>).detail;
      if (!detail || typeof detail.badge_count !== "number") return;
      if (detail.guardRefresh) {
        applySnapshot(detail, { fromUserAction: true });
        return;
      }
      applySnapshot(detail);
    };
    window.addEventListener(GWADA_DISPLAY_TODOS_REFRESH_EVENT, onRefresh);
    window.addEventListener(GWADA_DISPLAY_TODOS_BADGE_SNAPSHOT_EVENT, onSnapshot);
    return () => {
      window.removeEventListener(GWADA_DISPLAY_TODOS_REFRESH_EVENT, onRefresh);
      window.removeEventListener(
        GWADA_DISPLAY_TODOS_BADGE_SNAPSHOT_EVENT,
        onSnapshot,
      );
    };
  }, [refresh, applySnapshot]);

  return { count, urgency, refresh };
}
