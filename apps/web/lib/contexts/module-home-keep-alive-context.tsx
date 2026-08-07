"use client";

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import {
  normalizeNavHref,
  useSoftNavLock,
} from "@/components/providers/soft-nav-lock-provider";
import {
  MODULE_HOME_IDS,
  MODULE_HOME_PATHS,
  MODULE_HOME_PREWARM_IDS,
  isModuleHomePath,
  isWarmModuleHomePending,
  matchModuleHomeId,
  type ModuleHomeId,
} from "@/lib/navigation/module-home-keep-alive";
import { onDashboardFirstKpiReady } from "@/lib/dashboard/dashboard-first-kpi-ready";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { isDashboardHomePath } from "@/lib/navigation/dashboard-home-path";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export type ModuleHomeSlotState = {
  warm: boolean;
  visible: boolean;
  active: boolean;
};

type ModuleHomeKeepAliveValue = {
  slots: Record<ModuleHomeId, ModuleHomeSlotState>;
  warmIds: ReadonlySet<ModuleHomeId>;
  isPendingWarmHome: (pendingHref: string) => boolean;
};

const ModuleHomeKeepAliveContext =
  createContext<ModuleHomeKeepAliveValue | null>(null);

function emptySlots(): Record<ModuleHomeId, boolean> {
  return {
    dashboard: false,
    menu: false,
    inventory: false,
    reservierungen: false,
    nachrichten: false,
    mitarbeiter: false,
  };
}

/** Failsafe: Keep-alive Homes auch ohne KPI-Event vorwärmen. */
const PREWARM_FAILSAFE_MS = 1_000;

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

  useLayoutEffect(() => {
    if (!activeHomeId) return;
    setWarmFlags((prev) =>
      prev[activeHomeId] ? prev : { ...prev, [activeHomeId]: true },
    );
  }, [activeHomeId]);

  // Erster Soft-Nav: Slots schon gemountet + Daten warm — Preview ohne RSC-Wartezeit.
  useEffect(() => {
    if (
      !workspaceReady ||
      !restaurantId ||
      !isUuidRestaurantId(restaurantId)
    ) {
      return;
    }

    let cancelled = false;
    let prewarmStarted = false;
    const timers: number[] = [];

    const markPrewarmStaggered = () => {
      if (cancelled || prewarmStarted) return;
      prewarmStarted = true;
      MODULE_HOME_PREWARM_IDS.forEach((id, index) => {
        timers.push(
          window.setTimeout(() => {
            if (cancelled) return;
            setWarmFlags((prev) =>
              prev[id] ? prev : { ...prev, [id]: true },
            );
          }, index * 120),
        );
      });
    };

    if (!isDashboardHomePath(pathname)) {
      markPrewarmStaggered();
      return () => {
        cancelled = true;
        for (const id of timers) window.clearTimeout(id);
      };
    }

    const unsub = onDashboardFirstKpiReady(
      restaurantId,
      markPrewarmStaggered,
    );
    const failsafe = window.setTimeout(
      markPrewarmStaggered,
      PREWARM_FAILSAFE_MS,
    );
    return () => {
      cancelled = true;
      unsub();
      window.clearTimeout(failsafe);
      for (const id of timers) window.clearTimeout(id);
    };
  }, [pathname, restaurantId, workspaceReady]);

  const pendingHomeId =
    pendingHref != null ? matchModuleHomeId(pendingHref) : null;
  const pendingNormalized =
    pendingHref != null ? normalizeNavHref(pendingHref) : null;

  const value = useMemo<ModuleHomeKeepAliveValue>(() => {
    const warmIds = new Set<ModuleHomeId>();
    const slots = {} as Record<ModuleHomeId, ModuleHomeSlotState>;
    // Solange Soft-Nav Pending gesetzt ist: Quell-Home versteckt halten
    // (auch wenn pathname kurz zurückspringt — sonst Dashboard-Flash).
    const pendingInFlight = pendingNormalized != null;

    for (const id of MODULE_HOME_IDS) {
      const onHome = activeHomeId === id;
      const warm = warmFlags[id] || onHome;
      if (warm) warmIds.add(id);

      const pendingToThis =
        warm &&
        pendingHomeId === id &&
        pendingNormalized === MODULE_HOME_PATHS[id] &&
        !onHome;

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
    };
  }, [activeHomeId, warmFlags, pendingHomeId, pendingNormalized]);

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
