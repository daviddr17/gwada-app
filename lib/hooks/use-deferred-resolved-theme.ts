"use client";

import { useRef } from "react";
import { useTheme } from "@/components/providers/theme-provider";
import { useThemeTransitionActive } from "@/lib/hooks/use-theme-transition-active";
import { isThemeTransitionPaused } from "@/lib/ui/theme-transition";

/** Hell/Dunkel — während View-Transition eingefroren (kein Logo-/Asset-Flackern). */
export function useDeferredResolvedTheme(): "light" | "dark" {
  useThemeTransitionActive();
  const { resolvedTheme } = useTheme();
  const next = resolvedTheme === "dark" ? "dark" : "light";
  const stored = useRef<"light" | "dark">(next);

  if (!isThemeTransitionPaused()) {
    stored.current = next;
  }

  return stored.current;
}
