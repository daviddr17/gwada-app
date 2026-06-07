"use client";

import { useEffect, useState } from "react";
import {
  isThemeTransitionPaused,
  THEME_TRANSITION_END_EVENT,
  THEME_TRANSITION_START_EVENT,
} from "@/lib/ui/theme-transition";

/** Re-render, wenn ein Theme-Crossfade startet/endet (Animationen kurz pausieren). */
export function useThemeTransitionActive(): boolean {
  const [active, setActive] = useState(isThemeTransitionPaused);

  useEffect(() => {
    const onStart = () => setActive(true);
    const onEnd = () => setActive(false);

    window.addEventListener(THEME_TRANSITION_START_EVENT, onStart);
    window.addEventListener(THEME_TRANSITION_END_EVENT, onEnd);
    return () => {
      window.removeEventListener(THEME_TRANSITION_START_EVENT, onStart);
      window.removeEventListener(THEME_TRANSITION_END_EVENT, onEnd);
    };
  }, []);

  return active;
}
