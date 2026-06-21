"use client";

import { useCallback, useEffect, useState } from "react";
import { GWADA_DISPLAY_TODOS_REFRESH_EVENT } from "@/lib/display/display-todos-live-events";
import type { StaffTodoDisplayUrgency } from "@/lib/staff/staff-todo-status";

export function useDisplayTodoBadgeCount(enabled: boolean): {
  count: number;
  urgency: StaffTodoDisplayUrgency;
  refresh: () => Promise<void>;
} {
  const [count, setCount] = useState(0);
  const [urgency, setUrgency] = useState<StaffTodoDisplayUrgency>("green");

  const refresh = useCallback(async () => {
    if (!enabled) {
      setCount(0);
      setUrgency("green");
      return;
    }
    try {
      const res = await fetch("/api/display/todos?badge_only=1", {
        cache: "no-store",
        credentials: "include",
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        badge_count?: number;
        badge_urgency?: StaffTodoDisplayUrgency;
      };
      setCount(data.badge_count ?? 0);
      setUrgency(data.badge_urgency ?? "green");
    } catch {
      /* ignore */
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
    const onRefresh = () => void refresh();
    window.addEventListener(GWADA_DISPLAY_TODOS_REFRESH_EVENT, onRefresh);
    return () =>
      window.removeEventListener(GWADA_DISPLAY_TODOS_REFRESH_EVENT, onRefresh);
  }, [refresh]);

  return { count, urgency, refresh };
}
