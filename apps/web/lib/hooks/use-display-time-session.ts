"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DISPLAY_TIME_SESSION_OFF,
  type DisplayTimeSessionState,
} from "@/lib/display/display-time-status";
import type { DisplayContextResponse } from "@/lib/display/display-types";

export function useDisplayTimeSession(
  enabled: boolean,
  initial: DisplayContextResponse["time_session"],
): {
  state: DisplayTimeSessionState;
  refresh: () => Promise<void>;
  patch: (next: DisplayTimeSessionState) => void;
} {
  const [state, setState] = useState<DisplayTimeSessionState>(
    initial ?? DISPLAY_TIME_SESSION_OFF,
  );

  useEffect(() => {
    if (!enabled) {
      setState(DISPLAY_TIME_SESSION_OFF);
      return;
    }
    setState(initial ?? DISPLAY_TIME_SESSION_OFF);
  }, [enabled, initial]);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const res = await fetch("/api/display/context", {
        cache: "no-store",
        credentials: "include",
      });
      if (!res.ok) return;
      const data = (await res.json()) as DisplayContextResponse;
      setState(data.time_session ?? DISPLAY_TIME_SESSION_OFF);
    } catch {
      /* ignore background refresh */
    }
  }, [enabled]);

  const patch = useCallback((next: DisplayTimeSessionState) => {
    setState(next);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
    const id = setInterval(() => void refresh(), 30_000);
    return () => clearInterval(id);
  }, [enabled, refresh]);

  return { state, refresh, patch };
}
