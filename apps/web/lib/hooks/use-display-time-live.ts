"use client";

import { useCallback } from "react";
import { dispatchDisplayTimeRefresh } from "@/lib/display/display-time-live-events";
import { useDisplayModuleLivePoll } from "@/lib/hooks/use-display-module-live-poll";

export function useDisplayTimeLive(enabled: boolean) {
  const onRefresh = useCallback(() => {
    dispatchDisplayTimeRefresh();
  }, []);

  useDisplayModuleLivePoll(
    enabled,
    "/api/display/time/live-signal",
    onRefresh,
  );
}
