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
  isWarmModuleHomePending,
  matchModuleHomeId,
  moduleHomeSlotVisibility,
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

/** Idle-Prewarm nach First-Paint — nicht Sekunden warten. */
const IDLE_PREWARM_AFTER_KPI_MS = 700;
const IDLE_PREWARM_GAP_MS = 280;

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
  const warmFlagsRef = useRef(warmFlags);
  warmFlagsRef.current = warmFlags;
  /** LRU-Reihenfolge der Extra-Homes (älteste zuerst). */
  const warmOrderRef = useRef<ModuleHomeId[]>([]);

  const applyWarmFlags = useCallback((id: ModuleHomeId) => {
    setWarmFlags((prev) => {
      const active = activeHomeIdRef.current;
      const pending = pendingHomeIdRef.current;
      const protectedIds = new Set<ModuleHomeId>(["dashboard", id]);
      if (active) protectedIds.add(active);
      if (pending) protectedIds.add(pending);

      // Schon warm und keine Eviction nötig → nur LRU anfassen, kein Re-Render.
      if (prev[id]) {
        let order = warmOrderRef.current.filter((x) => x !== id);
        order.push(id);
        warmOrderRef.current = order;
        return prev;
      }

      const next = { ...prev, [id]: true };
      if (active) next[active] = true;
      if (pending) next[pending] = true;

      let order = warmOrderRef.current.filter((x) => x !== id);
      order.push(id);

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

  const warmModuleHomeSync = useCallback(
    (id: ModuleHomeId) => {
      if (id === "dashboard") return;
      // Bereits warm: kein flushSync (Ping-Pong / Rapid-Clicks sonst Main-Thread-Jank).
      if (warmFlagsRef.current[id]) {
        applyWarmFlags(id);
        return;
      }
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

  // Sidebar Intent: sync nur beim ersten Mount des Ziel-Moduls.
  useEffect(
    () => onModuleHomeWarmIntent((id) => warmModuleHomeSync(id)),
    [warmModuleHomeSync],
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
      const slot = moduleHomeSlotVisibility({
        id,
        activeHomeId,
        pendingHomeId,
        pendingInFlight,
        warmFlag: warmFlags[id],
      });
      if (slot.warm) warmIds.add(id);
      slots[id] = slot;
    }

    return {
      slots,
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

/** Compat für Dashboard-Batch-Hooks. */
export function useDashboardHomeKeepAliveOptional(): ModuleHomeSlotState | null {
  return useModuleHomeSlotOptional("dashboard");
}
