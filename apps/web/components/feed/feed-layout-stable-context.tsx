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
  const [stable, setStable] = useState(!enabled || itemCount === 0);

  useEffect(() => {
    pendingRef.current = 0;
    setStable(!enabled || itemCount === 0);
  }, [itemCount, enabled]);

  const registerPending = useCallback(() => {
    if (!enabled) return;
    pendingRef.current += 1;
    setStable(false);
  }, [enabled]);

  const markLoaded = useCallback(() => {
    if (!enabled) return;
    pendingRef.current = Math.max(0, pendingRef.current - 1);
    if (pendingRef.current === 0) {
      setStable(true);
    }
  }, [enabled]);

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
