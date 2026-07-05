"use client";

import { useCallback } from "react";
import { dispatchDisplayInventoryRefresh } from "@/lib/display/display-inventory-live-events";
import { useDisplayModuleLivePoll } from "@/lib/hooks/use-display-module-live-poll";

export function useDisplayInventoryLive(enabled: boolean) {
  const onRefresh = useCallback(() => {
    dispatchDisplayInventoryRefresh();
  }, []);

  useDisplayModuleLivePoll(
    enabled,
    "/api/display/inventory/live-signal",
    onRefresh,
  );
}
