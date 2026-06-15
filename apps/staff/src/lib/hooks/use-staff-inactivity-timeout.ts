import { useCallback, useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { usePinLockStore } from "@/src/stores/pin-lock-store";

const INACTIVITY_MS = 15 * 60 * 1000;

/** Locks staff app after 15 minutes without interaction. */
export function useStaffInactivityTimeout(enabled: boolean) {
  const lock = usePinLockStore((s) => s.lock);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActiveRef = useRef(Date.now());

  const resetTimer = useCallback(() => {
    lastActiveRef.current = Date.now();
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!enabled) return;
    timerRef.current = setTimeout(() => {
      lock();
    }, INACTIVITY_MS);
  }, [enabled, lock]);

  useEffect(() => {
    if (!enabled) return;

    resetTimer();

    const onAppState = (next: AppStateStatus) => {
      if (next === "active") {
        const idle = Date.now() - lastActiveRef.current;
        if (idle >= INACTIVITY_MS) {
          lock();
        } else {
          resetTimer();
        }
      } else if (next === "background" || next === "inactive") {
        lastActiveRef.current = Date.now();
      }
    };

    const sub = AppState.addEventListener("change", onAppState);
    const interval = setInterval(() => {
      if (Date.now() - lastActiveRef.current >= INACTIVITY_MS) {
        lock();
      }
    }, 30_000);

    return () => {
      sub.remove();
      clearInterval(interval);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, lock, resetTimer]);

  return { bumpActivity: resetTimer };
}
