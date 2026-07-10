"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { APP_ROUTES } from "@/lib/navigation/app-routes";

type DashboardGlobalSearchContextValue = {
  open: boolean;
  openSearch: () => void;
  closeSearch: () => void;
  toggleSearch: () => void;
};

const DashboardGlobalSearchContext =
  createContext<DashboardGlobalSearchContextValue | null>(null);

function isRestaurantDashboardPath(pathname: string): boolean {
  return (
    pathname === APP_ROUTES.dashboard ||
    pathname.startsWith(`${APP_ROUTES.dashboard}/`)
  );
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
}

export function DashboardGlobalSearchProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const dashboardPath = isRestaurantDashboardPath(pathname);

  const openSearch = useCallback(() => {
    if (!dashboardPath) return;
    setOpen(true);
  }, [dashboardPath]);

  const closeSearch = useCallback(() => {
    setOpen(false);
  }, []);

  const toggleSearch = useCallback(() => {
    if (!dashboardPath) return;
    setOpen((value) => !value);
  }, [dashboardPath]);

  useEffect(() => {
    if (!dashboardPath) {
      setOpen(false);
    }
  }, [dashboardPath]);

  useEffect(() => {
    if (!dashboardPath) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") {
        return;
      }
      if (isEditableTarget(event.target) && !open) return;
      event.preventDefault();
      toggleSearch();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dashboardPath, open, toggleSearch]);

  const value = useMemo(
    () => ({
      open,
      openSearch,
      closeSearch,
      toggleSearch,
    }),
    [open, openSearch, closeSearch, toggleSearch],
  );

  return (
    <DashboardGlobalSearchContext.Provider value={value}>
      {children}
    </DashboardGlobalSearchContext.Provider>
  );
}

export function useDashboardGlobalSearch(): DashboardGlobalSearchContextValue {
  const ctx = useContext(DashboardGlobalSearchContext);
  if (!ctx) {
    throw new Error(
      "useDashboardGlobalSearch erfordert DashboardGlobalSearchProvider.",
    );
  }
  return ctx;
}

export function useDashboardGlobalSearchOptional(): DashboardGlobalSearchContextValue | null {
  return useContext(DashboardGlobalSearchContext);
}

export { isRestaurantDashboardPath };
