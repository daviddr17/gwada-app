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

async function cleanupAuthCookiesBeforeNav(): Promise<void> {
  try {
    await fetch("/api/auth/cleanup-cookies", { credentials: "include" });
  } catch {
    // Proxy strippt gwada_* serverseitig.
  }
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

  const waitForRscFlight = useCallback((target: string) => {
    const normalizedTarget = normalizePath(target.split("?")[0] ?? target);

    return new Promise<void>((resolve) => {
      const startedAt = Date.now();
      let stableFrames = 0;

      const tick = () => {
        const atTarget =
          normalizePath(window.location.pathname) === normalizedTarget;
        const settled = atTarget && !isPendingRef.current && !hasLoadErrorOverlay();

        if (settled) {
          stableFrames += 1;
          if (stableFrames >= 4) {
            resolve();
            return;
          }
        } else {
          stableFrames = 0;
        }

        if (Date.now() - startedAt >= 15_000) {
          resolve();
          return;
        }
        requestAnimationFrame(tick);
      };

      requestAnimationFrame(tick);
    });
  }, []);

  const performOneNav = useCallback(
    async (target: string, replace: boolean) => {
      const toHome = isDashboardHomePath(target);
      if (toHome) await cleanupAuthCookiesBeforeNav();

      for (let attempt = 0; attempt < 2; attempt += 1) {
        await new Promise<void>((resolve) => {
          startTransition(() => {
            if (replace || toHome) router.replace(target);
            else router.push(target);
            resolve();
          });
        });

        await waitForRscFlight(target);

        const ok =
          normalizePath(window.location.pathname) ===
            normalizePath(target.split("?")[0] ?? target) &&
          !hasLoadErrorOverlay();
        if (ok) return;

        if (toHome) {
          await cleanupAuthCookiesBeforeNav();
          router.refresh();
        }
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
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        });
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
