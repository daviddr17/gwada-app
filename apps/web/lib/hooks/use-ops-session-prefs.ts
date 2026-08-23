"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  getOpsSessionPrefs,
  setOpsQuietMode,
  subscribeOpsSessionPrefs,
  toggleOpsQuietMode,
  type OpsSessionPrefs,
} from "@/lib/ops/ops-session-prefs";

export function useOpsSessionPrefs(): OpsSessionPrefs & {
  setQuietMode: (value: boolean) => void;
  toggleQuietMode: () => boolean;
} {
  const prefs = useSyncExternalStore(
    subscribeOpsSessionPrefs,
    getOpsSessionPrefs,
    getOpsSessionPrefs,
  );

  const setQuietMode = useCallback((value: boolean) => {
    setOpsQuietMode(value);
  }, []);

  const toggleQuietMode = useCallback(() => toggleOpsQuietMode(), []);

  return {
    ...prefs,
    setQuietMode,
    toggleQuietMode,
  };
}
