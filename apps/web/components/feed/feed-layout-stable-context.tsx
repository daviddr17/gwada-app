"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type FeedLayoutStableContextValue = {
  registerPending: () => void;
  markLoaded: () => void;
  stable: boolean;
};

const FeedLayoutStableContext =
  createContext<FeedLayoutStableContextValue | null>(null);

/** Tracks visible feed images until all report loaded (embed resize gating). */
export function FeedLayoutStableProvider({
  children,
  itemCount,
  enabled = true,
}: {
  children: ReactNode;
  itemCount: number;
  enabled?: boolean;
}) {
  const pendingRef = useRef(0);
  const stableRef = useRef(!enabled || itemCount === 0);
  const rafRef = useRef(0);
  const [stable, setStable] = useState(stableRef.current);

  useEffect(() => {
    pendingRef.current = 0;
    stableRef.current = !enabled || itemCount === 0;
    setStable(stableRef.current);
  }, [itemCount, enabled]);

  useEffect(
    () => () => {
      window.cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  const scheduleStableCheck = useCallback(() => {
    window.cancelAnimationFrame(rafRef.current);
    rafRef.current = window.requestAnimationFrame(() => {
      const nextStable = pendingRef.current === 0;
      if (nextStable === stableRef.current) return;
      stableRef.current = nextStable;
      setStable(nextStable);
    });
  }, []);

  const registerPending = useCallback(() => {
    if (!enabled) return;
    pendingRef.current += 1;
    if (stableRef.current) {
      stableRef.current = false;
      setStable(false);
    }
  }, [enabled]);

  const markLoaded = useCallback(() => {
    if (!enabled) return;
    pendingRef.current = Math.max(0, pendingRef.current - 1);
    scheduleStableCheck();
  }, [enabled, scheduleStableCheck]);

  const value = useMemo(
    () => ({ registerPending, markLoaded, stable }),
    [registerPending, markLoaded, stable],
  );

  return (
    <FeedLayoutStableContext.Provider value={value}>
      {children}
    </FeedLayoutStableContext.Provider>
  );
}

export function useFeedLayoutStable() {
  return useContext(FeedLayoutStableContext);
}
