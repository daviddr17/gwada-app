"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
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
  MODULE_HOME_IDLE_PREWARM_IDS,
  MODULE_HOME_MAX_EXTRA_WARM,
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

export type ModuleHomeSlotState = {
  warm: boolean;
  visible: boolean;
  active: boolean;
};

type ModuleHomeKeepAliveValue = {
  slots: Record<ModuleHomeId, ModuleHomeSlotState>;
  warmIds: ReadonlySet<ModuleHomeId>;
  isPendingWarmHome: (pendingHref: string) => boolean;
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

/** Idle-Prewarm erst wenn Dashboard-Stream durch ist — nicht alle Module. */
const IDLE_PREWARM_AFTER_KPI_MS = 2_400;
const IDLE_PREWARM_GAP_MS = 450;

export function ModuleHomeKeepAliveProvider({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const { pendingHref } = useSoftNavLock();
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const activeHomeId = matchModuleHomeId(pathname);
  const activeHomeIdRef = useRef(activeHomeId);
  activeHomeIdRef.current = activeHomeId;
  const pendingHomeId =
    pendingHref != null ? matchModuleHomeId(pendingHref) : null;
  const pendingHomeIdRef = useRef(pendingHomeId);
  pendingHomeIdRef.current = pendingHomeId;

  const [warmFlags, setWarmFlags] = useState(() => {
    const initial = emptySlots();
    if (activeHomeId) initial[activeHomeId] = true;
    return initial;
  });
  /** LRU-Reihenfolge der Extra-Homes (älteste zuerst). */
  const warmOrderRef = useRef<ModuleHomeId[]>([]);

  const applyWarmFlags = useCallback((id: ModuleHomeId) => {
    setWarmFlags((prev) => {
      const active = activeHomeIdRef.current;
      const pending = pendingHomeIdRef.current;
      const protectedIds = new Set<ModuleHomeId>(["dashboard", id]);
      if (active) protectedIds.add(active);
      if (pending) protectedIds.add(pending);

      const next = { ...prev, [id]: true };
      if (active) next[active] = true;
      if (pending) next[pending] = true;

      let order = warmOrderRef.current.filter((x) => x !== id);
      order.push(id);

      // Evict älteste nicht-geschützte Homes über dem Cap.
      const extras = order.filter((x) => !protectedIds.has(x) && next[x]);
      while (extras.length > MODULE_HOME_MAX_EXTRA_WARM) {
        const evict = extras.shift();
        if (!evict) break;
        next[evict] = false;
        order = order.filter((x) => x !== evict);
      }

      warmOrderRef.current = order.filter((x) => next[x]);
      return next;
    });
  }, []);

  const ensureModuleHomeWarm = useCallback(
    (id: ModuleHomeId) => {
      if (id === "dashboard") return;
      // Nur Intent: ein Slot sync mounten — Preview ohne RSC-Wartezeit.
      // Kein Bulk-Prewarm mit flushSync (das laggt).
      flushSync(() => {
        applyWarmFlags(id);
      });
    },
    [applyWarmFlags],
  );

  useLayoutEffect(() => {
    if (!activeHomeId) return;
    applyWarmFlags(activeHomeId);
  }, [activeHomeId, applyWarmFlags]);

  // Sidebar Intent: sync Preview (ein Modul), nicht Massen-Mount.
  useEffect(
    () =>
      onModuleHomeWarmIntent((id) => {
        flushSync(() => {
          applyWarmFlags(id);
        });
      }),
    [applyWarmFlags],
  );

  // Nur 1–2 Homes, sehr spät, nur solange Nutzer auf Dashboard bleibt.
  useEffect(() => {
    if (
      !workspaceReady ||
      !restaurantId ||
      !isUuidRestaurantId(restaurantId) ||
      !isDashboardHomePath(pathname)
    ) {
      return;
    }

    let cancelled = false;
    const timers: number[] = [];

    const startIdlePrewarm = () => {
      if (cancelled || !isDashboardHomePath(pathname)) return;
      MODULE_HOME_IDLE_PREWARM_IDS.forEach((id, index) => {
        timers.push(
          window.setTimeout(() => {
            if (cancelled) return;
            if (!isDashboardHomePath(pathname)) return;
            applyWarmFlags(id);
          }, index * IDLE_PREWARM_GAP_MS),
        );
      });
    };

    const unsub = onDashboardFirstKpiReady(restaurantId, () => {
      timers.push(
        window.setTimeout(startIdlePrewarm, IDLE_PREWARM_AFTER_KPI_MS),
      );
    });
    const failsafe = window.setTimeout(
      startIdlePrewarm,
      IDLE_PREWARM_AFTER_KPI_MS + 1_200,
    );

    return () => {
      cancelled = true;
      unsub();
      window.clearTimeout(failsafe);
      for (const id of timers) window.clearTimeout(id);
    };
  }, [applyWarmFlags, pathname, restaurantId, workspaceReady]);

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
