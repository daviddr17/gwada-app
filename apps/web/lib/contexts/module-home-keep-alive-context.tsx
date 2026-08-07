"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";
import { usePathname } from "next/navigation";
import {
  normalizeNavHref,
  useSoftNavLock,
} from "@/components/providers/soft-nav-lock-provider";
import {
  MODULE_HOME_IDS,
  MODULE_HOME_PRIORITY_PREWARM_IDS,
  MODULE_HOME_SECONDARY_PREWARM_IDS,
  isModuleHomePath,
  isWarmModuleHomePending,
  matchModuleHomeId,
  type ModuleHomeId,
} from "@/lib/navigation/module-home-keep-alive";
import { onDashboardFirstKpiReady } from "@/lib/dashboard/dashboard-first-kpi-ready";
import { onModuleHomeWarmIntent } from "@/lib/navigation/module-home-warm-intent";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { isDashboardHomePath } from "@/lib/navigation/dashboard-home-path";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import { runWhenIdle } from "@/lib/ui/run-when-idle";

export type ModuleHomeSlotState = {
  warm: boolean;
  visible: boolean;
  active: boolean;
};

type ModuleHomeKeepAliveValue = {
  slots: Record<ModuleHomeId, ModuleHomeSlotState>;
  warmIds: ReadonlySet<ModuleHomeId>;
  isPendingWarmHome: (pendingHref: string) => boolean;
  /** Intent: Slot sync mounten (flushSync) — Soft-Nav kann sofort previewen. */
  ensureModuleHomeWarm: (id: ModuleHomeId) => void;
};

const ModuleHomeKeepAliveContext =
  createContext<ModuleHomeKeepAliveValue | null>(null);

function emptySlots(): Record<ModuleHomeId, boolean> {
  return {
    dashboard: false,
    menu: false,
    inventory: false,
    reservierungen: false,
    pos: false,
    events: false,
    nachrichten: false,
    news: false,
    bewertungen: false,
    insights: false,
    galerie: false,
    buchfuehrung: false,
    dokumente: false,
    checklisten: false,
    mitarbeiter: false,
  };
}

/** Failsafe Priority ohne KPI. */
const PRIORITY_PREWARM_FAILSAFE_MS = 1_000;
/** Secondary erst nachdem Batch Luft hat. */
const SECONDARY_PREWARM_AFTER_KPI_MS = 2_200;

export function ModuleHomeKeepAliveProvider({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const { pendingHref } = useSoftNavLock();
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const activeHomeId = matchModuleHomeId(pathname);
  const [warmFlags, setWarmFlags] = useState(() => {
    const initial = emptySlots();
    if (activeHomeId) initial[activeHomeId] = true;
    return initial;
  });

  const markWarm = useCallback((id: ModuleHomeId, sync = false) => {
    const apply = () =>
      setWarmFlags((prev) => (prev[id] ? prev : { ...prev, [id]: true }));
    if (sync) flushSync(apply);
    else apply();
  }, []);

  const ensureModuleHomeWarm = useCallback(
    (id: ModuleHomeId) => {
      if (id === "dashboard") return;
      markWarm(id, true);
    },
    [markWarm],
  );

  useLayoutEffect(() => {
    if (!activeHomeId) return;
    markWarm(activeHomeId, false);
  }, [activeHomeId, markWarm]);

  // Sidebar hover/tap Intent (auch von AppNavLink vor Soft-Nav).
  useEffect(() => onModuleHomeWarmIntent((id) => markWarm(id, true)), [
    markWarm,
  ]);

  // Priority nach KPI; Secondary idle/verzögert — Dashboard-Stream bleibt frei.
  useEffect(() => {
    if (
      !workspaceReady ||
      !restaurantId ||
      !isUuidRestaurantId(restaurantId)
    ) {
      return;
    }

    let cancelled = false;
    let priorityStarted = false;
    let secondaryStarted = false;
    const timers: number[] = [];

    const staggerWarm = (ids: readonly ModuleHomeId[], gapMs: number) => {
      ids.forEach((id, index) => {
        timers.push(
          window.setTimeout(() => {
            if (cancelled) return;
            markWarm(id, false);
          }, index * gapMs),
        );
      });
    };

    const startPriority = () => {
      if (cancelled || priorityStarted) return;
      priorityStarted = true;
      staggerWarm(MODULE_HOME_PRIORITY_PREWARM_IDS, 140);
    };

    const startSecondary = () => {
      if (cancelled || secondaryStarted) return;
      secondaryStarted = true;
      staggerWarm(MODULE_HOME_SECONDARY_PREWARM_IDS, 180);
    };

    if (!isDashboardHomePath(pathname)) {
      startPriority();
      runWhenIdle(startSecondary, 400);
      return () => {
        cancelled = true;
        for (const id of timers) window.clearTimeout(id);
      };
    }

    const onKpi = () => {
      startPriority();
      timers.push(
        window.setTimeout(startSecondary, SECONDARY_PREWARM_AFTER_KPI_MS),
      );
    };

    const unsub = onDashboardFirstKpiReady(restaurantId, onKpi);
    const failsafe = window.setTimeout(onKpi, PRIORITY_PREWARM_FAILSAFE_MS);

    return () => {
      cancelled = true;
      unsub();
      window.clearTimeout(failsafe);
      for (const id of timers) window.clearTimeout(id);
    };
  }, [markWarm, pathname, restaurantId, workspaceReady]);

  const pendingHomeId =
    pendingHref != null ? matchModuleHomeId(pendingHref) : null;
  const pendingNormalized =
    pendingHref != null ? normalizeNavHref(pendingHref) : null;

  const value = useMemo<ModuleHomeKeepAliveValue>(() => {
    const warmIds = new Set<ModuleHomeId>();
    const slots = {} as Record<ModuleHomeId, ModuleHomeSlotState>;
    const pendingInFlight = pendingNormalized != null;

    for (const id of MODULE_HOME_IDS) {
      const onHome = activeHomeId === id;
      const warm = warmFlags[id] || onHome;
      if (warm) warmIds.add(id);

      // pendingHomeId reicht — Events-Alias / Query-Strings brauchen keinen Exact-Path.
      const pendingToThis = warm && pendingHomeId === id && !onHome;
      const showAsSource = onHome && !pendingInFlight;

      slots[id] = {
        warm,
        visible: showAsSource || pendingToThis,
        active: showAsSource,
      };
    }

    return {
      slots,
      warmIds,
      isPendingWarmHome: (href: string) =>
        isWarmModuleHomePending(href, warmIds),
      ensureModuleHomeWarm,
    };
  }, [
    activeHomeId,
    warmFlags,
    pendingHomeId,
    pendingNormalized,
    ensureModuleHomeWarm,
  ]);

  return (
    <ModuleHomeKeepAliveContext.Provider value={value}>
      {children}
    </ModuleHomeKeepAliveContext.Provider>
  );
}

export function useModuleHomeKeepAlive(): ModuleHomeKeepAliveValue {
  const ctx = useContext(ModuleHomeKeepAliveContext);
  if (!ctx) {
    throw new Error(
      "useModuleHomeKeepAlive requires ModuleHomeKeepAliveProvider",
    );
  }
  return ctx;
}

export function useModuleHomeKeepAliveOptional(): ModuleHomeKeepAliveValue | null {
  return useContext(ModuleHomeKeepAliveContext);
}

export function useModuleHomeSlot(id: ModuleHomeId): ModuleHomeSlotState {
  const { slots } = useModuleHomeKeepAlive();
  return slots[id];
}

export function useModuleHomeSlotOptional(
  id: ModuleHomeId,
): ModuleHomeSlotState | null {
  const ctx = useModuleHomeKeepAliveOptional();
  return ctx?.slots[id] ?? null;
}

/** @deprecated Prefer useModuleHomeSlot('dashboard') — Compat für Batch-Hooks. */
export function useDashboardHomeKeepAliveOptional(): ModuleHomeSlotState | null {
  return useModuleHomeSlotOptional("dashboard");
}

export function isModuleHomePathActive(
  pathname: string,
  id: ModuleHomeId,
): boolean {
  return isModuleHomePath(pathname, id);
}
