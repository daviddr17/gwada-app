"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { isDashboardHomePath } from "@/lib/navigation/dashboard-home-path";
import { registerSoftNavCoordinator } from "@/lib/navigation/soft-nav-coordinator-bridge";

function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.slice(0, -1);
  return pathname;
}

function hasLoadErrorOverlay(): boolean {
  return document.body.innerText.includes("couldn't load");
}

function cleanupAuthCookiesBeforeNav(): void {
  void fetch("/api/auth/cleanup-cookies", { credentials: "include" }).catch(
    () => {},
  );
}

type ScheduleOptions = {
  replace?: boolean;
};

type SoftNavCoordinatorValue = {
  scheduleCrossModuleNav: (target: string, options?: ScheduleOptions) => void;
  isNavigating: boolean;
};

const SoftNavCoordinatorContext = createContext<SoftNavCoordinatorValue | null>(
  null,
);

export function useSoftNavCoordinator(): SoftNavCoordinatorValue {
  const ctx = useContext(SoftNavCoordinatorContext);
  if (!ctx) {
    throw new Error("useSoftNavCoordinator requires SoftNavCoordinatorProvider");
  }
  return ctx;
}

export function SoftNavCoordinatorProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isPendingRef = useRef(isPending);
  isPendingRef.current = isPending;

  const [isDraining, setIsDraining] = useState(false);
  const pendingTargetRef = useRef<string | null>(null);
  const pendingReplaceRef = useRef(false);
  const drainingRef = useRef(false);

  const isSuperseded = useCallback((target: string) => {
    const pending = pendingTargetRef.current;
    if (!pending) return false;
    return (
      normalizePath(pending.split("?")[0] ?? pending) !==
      normalizePath(target.split("?")[0] ?? target)
    );
  }, []);

  /** true = settled, false = abgebrochen (neueres Ziel in Queue). */
  const waitForRscFlight = useCallback(
    (target: string) => {
      const normalizedTarget = normalizePath(target.split("?")[0] ?? target);

      return new Promise<boolean>((resolve) => {
        const startedAt = Date.now();
        let stableFrames = 0;

        const tick = () => {
          if (isSuperseded(target)) {
            resolve(false);
            return;
          }

          const atTarget =
            normalizePath(window.location.pathname) === normalizedTarget;
          const settled =
            atTarget && !isPendingRef.current && !hasLoadErrorOverlay();

          if (settled) {
            stableFrames += 1;
            if (stableFrames >= 2) {
              resolve(true);
              return;
            }
          } else {
            stableFrames = 0;
          }

          if (Date.now() - startedAt >= 10_000) {
            resolve(!hasLoadErrorOverlay());
            return;
          }
          requestAnimationFrame(tick);
        };

        requestAnimationFrame(tick);
      });
    },
    [isSuperseded],
  );

  const performOneNav = useCallback(
    async (target: string, replace: boolean) => {
      const toHome = isDashboardHomePath(target);
      if (toHome) cleanupAuthCookiesBeforeNav();

      startTransition(() => {
        if (replace || toHome) router.replace(target);
        else router.push(target);
      });

      const settled = await waitForRscFlight(target);
      if (!settled || isSuperseded(target)) return;

      if (hasLoadErrorOverlay() && toHome) {
        cleanupAuthCookiesBeforeNav();
        startTransition(() => router.refresh());
        await waitForRscFlight(target);
      }
    },
    [router, startTransition, waitForRscFlight],
  );

  const drainQueue = useCallback(async () => {
    if (drainingRef.current) return;
    drainingRef.current = true;
    setIsDraining(true);
    try {
      while (pendingTargetRef.current) {
        const target = pendingTargetRef.current;
        const replace = pendingReplaceRef.current;
        pendingTargetRef.current = null;
        await performOneNav(target, replace);
      }
    } finally {
      drainingRef.current = false;
      setIsDraining(false);
      if (pendingTargetRef.current) void drainQueue();
    }
  }, [performOneNav]);

  const scheduleCrossModuleNav = useCallback(
    (target: string, options?: ScheduleOptions) => {
      pendingTargetRef.current = target;
      pendingReplaceRef.current =
        options?.replace ?? isDashboardHomePath(target);
      void drainQueue();
    },
    [drainQueue],
  );

  useEffect(
    () => registerSoftNavCoordinator(scheduleCrossModuleNav),
    [scheduleCrossModuleNav],
  );

  return (
    <SoftNavCoordinatorContext.Provider
      value={{
        scheduleCrossModuleNav,
        isNavigating: isPending || isDraining,
      }}
    >
      {children}
    </SoftNavCoordinatorContext.Provider>
  );
}
