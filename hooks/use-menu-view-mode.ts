"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "gwada-menu-view-mode";

export type MenuViewMode = "cards" | "compact";

export function useMenuViewMode() {
  const [mode, setModeState] = useState<MenuViewMode>("cards");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === "compact" || raw === "cards") {
        setModeState(raw);
      }
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  const setMode = (next: MenuViewMode) => {
    setModeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  };

  return { mode, setMode, ready };
}
