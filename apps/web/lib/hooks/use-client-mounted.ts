"use client";

import { useSyncExternalStore } from "react";

/** True nach Client-Hydration — SSR und erster Client-Paint bleiben identisch. */
export function useClientMounted(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}
