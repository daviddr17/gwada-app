"use client";

import { useCallback } from "react";
import { dispatchDisplayRecipesRefresh } from "@/lib/display/display-recipes-live-events";
import { useDisplayModuleLivePoll } from "@/lib/hooks/use-display-module-live-poll";

export function useDisplayRecipesLive(enabled: boolean) {
  const onRefresh = useCallback(() => {
    dispatchDisplayRecipesRefresh();
  }, []);

  useDisplayModuleLivePoll(
    enabled,
    "/api/display/recipes/live-signal",
    onRefresh,
  );
}
