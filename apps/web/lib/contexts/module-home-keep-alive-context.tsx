"use client";

import {
  createContext,
  useContext,
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
  isModuleHomePath,
  isWarmModuleHomePending,
  matchModuleHomeId,
  type ModuleHomeId,
} from "@/lib/navigation/module-home-keep-alive";

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
    reservierungen: false,
    nachrichten: false,
  };
}

export function ModuleHomeKeepAliveProvider({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const { pendingHref } = useSoftNavLock();
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

  const pendingHomeId =
    pendingHref != null ? matchModuleHomeId(pendingHref) : null;
  const pendingNormalized =
    pendingHref != null ? normalizeNavHref(pendingHref) : null;

  const value = useMemo<ModuleHomeKeepAliveValue>(() => {
    const warmIds = new Set<ModuleHomeId>();
    const slots = {} as Record<ModuleHomeId, ModuleHomeSlotState>;

    for (const id of MODULE_HOME_IDS) {
      const onHome = activeHomeId === id;
      const warm = warmFlags[id] || onHome;
      if (warm) warmIds.add(id);

      const pendingToThis =
        warm &&
        pendingHomeId === id &&
        pendingNormalized === MODULE_HOME_PATHS[id] &&
        !onHome;

      slots[id] = {
        warm,
        visible: onHome || pendingToThis,
        active: onHome,
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
