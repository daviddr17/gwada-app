"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_SIDEBAR_MODULE_ORDER,
  normalizeSidebarModuleOrder,
  type SidebarModuleId,
} from "@/lib/constants/sidebar-modules";

type SidebarModuleOrderContextValue = {
  order: SidebarModuleId[];
  isReady: boolean;
  applyOrder: (next: SidebarModuleId[]) => void;
  refresh: () => Promise<void>;
};

const SidebarModuleOrderContext =
  createContext<SidebarModuleOrderContextValue | null>(null);

export function SidebarModuleOrderProvider({
  children,
  initialOrder,
}: {
  children: ReactNode;
  initialOrder?: SidebarModuleId[] | null;
}) {
  const [order, setOrder] = useState<SidebarModuleId[]>(() =>
    initialOrder ? normalizeSidebarModuleOrder(initialOrder) : [...DEFAULT_SIDEBAR_MODULE_ORDER],
  );
  const [isReady, setIsReady] = useState(() => Boolean(initialOrder));

  const applyOrder = useCallback((next: SidebarModuleId[]) => {
    setOrder(normalizeSidebarModuleOrder(next));
    setIsReady(true);
  }, []);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/platform/sidebar-module-order", {
      cache: "no-store",
    });
    if (!res.ok) return;
    const data = (await res.json()) as { order?: unknown };
    applyOrder(normalizeSidebarModuleOrder(data.order));
  }, [applyOrder]);

  const value = useMemo(
    () => ({ order, isReady, applyOrder, refresh }),
    [order, isReady, applyOrder, refresh],
  );

  return (
    <SidebarModuleOrderContext.Provider value={value}>
      {children}
    </SidebarModuleOrderContext.Provider>
  );
}

export function useSidebarModuleOrder(): SidebarModuleOrderContextValue {
  const ctx = useContext(SidebarModuleOrderContext);
  if (!ctx) {
    return {
      order: [...DEFAULT_SIDEBAR_MODULE_ORDER],
      isReady: true,
      applyOrder: () => {},
      refresh: async () => {},
    };
  }
  return ctx;
}
