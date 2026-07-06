"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { PwaSplashGate } from "@/components/pwa/pwa-splash-gate";
import { displayPwaIconPath } from "@/lib/display/display-pwa-config";

const SPLASH_ICON_SRC = displayPwaIconPath(192);

type DisplayPwaSplashContextValue = {
  markDisplayPwaSplashReady: () => void;
};

const DisplayPwaSplashContext =
  createContext<DisplayPwaSplashContextValue | null>(null);

export function DisplayPwaSplashProvider({ children }: { children: ReactNode }) {
  const [contentReady, setContentReady] = useState(false);

  const markDisplayPwaSplashReady = useCallback(() => {
    setContentReady(true);
  }, []);

  return (
    <DisplayPwaSplashContext.Provider value={{ markDisplayPwaSplashReady }}>
      <PwaSplashGate app="display" iconSrc={SPLASH_ICON_SRC} isReady={contentReady}>
        {children}
      </PwaSplashGate>
    </DisplayPwaSplashContext.Provider>
  );
}

/** Display-Seite meldet, wenn initiale Daten geladen sind (Context / Pair-Check). */
export function useMarkDisplayPwaSplashReady(ready: boolean): void {
  const ctx = useContext(DisplayPwaSplashContext);
  useEffect(() => {
    if (ready) ctx?.markDisplayPwaSplashReady();
  }, [ctx, ready]);
}
