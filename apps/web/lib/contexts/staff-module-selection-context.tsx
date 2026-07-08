"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { RestaurantStaffRow } from "@/lib/types/staff";
import {
  pickStoredActiveStaffId,
  staffSelectOptionLabel,
} from "@/lib/staff/staff-select-options";

const STORAGE_KEY = "gwada-staff-module-selected";

type StaffModuleSelectionContextValue = {
  staffList: RestaurantStaffRow[];
  setStaffList: React.Dispatch<React.SetStateAction<RestaurantStaffRow[]>>;
  selectedStaffId: string | null;
  selectedStaff: RestaurantStaffRow | null;
  setSelectedStaffId: (id: string | null) => void;
  needsStaffPicker: boolean;
};

const StaffModuleSelectionContext =
  React.createContext<StaffModuleSelectionContextValue | null>(null);

export function StaffModuleSelectionProvider({
  children,
  needsStaffPicker,
}: {
  children: React.ReactNode;
  needsStaffPicker: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [staffList, setStaffList] = React.useState<RestaurantStaffRow[]>([]);

  const selectedStaffId = searchParams.get("staff");

  const selectedStaff = React.useMemo(
    () => staffList.find((s) => s.id === selectedStaffId) ?? null,
    [staffList, selectedStaffId],
  );

  const setSelectedStaffId = React.useCallback(
    (id: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (id) {
        params.set("staff", id);
        try {
          sessionStorage.setItem(STORAGE_KEY, id);
        } catch {
          /* ignore */
        }
      } else {
        params.delete("staff");
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  React.useEffect(() => {
    const skipAutoSelect =
      pathname.startsWith("/dashboard/mitarbeiter/vertraege") ||
      pathname.startsWith("/dashboard/mitarbeiter/dokumente") ||
      pathname.startsWith("/dashboard/mitarbeiter/arbeitszeiten");
    if (
      !needsStaffPicker ||
      selectedStaffId ||
      staffList.length === 0 ||
      skipAutoSelect
    ) {
      return;
    }
    let stored: string | null = null;
    try {
      stored = sessionStorage.getItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    const fallback = pickStoredActiveStaffId(staffList, stored);
    if (fallback) setSelectedStaffId(fallback);
  }, [needsStaffPicker, pathname, selectedStaffId, staffList, setSelectedStaffId]);

  React.useEffect(() => {
    if (!needsStaffPicker || !selectedStaffId || staffList.length === 0) return;
    const selected = staffList.find((s) => s.id === selectedStaffId);
    if (selected && !selected.is_active) {
      setSelectedStaffId(null);
    }
  }, [
    needsStaffPicker,
    selectedStaffId,
    staffList,
    setSelectedStaffId,
  ]);

  const value = React.useMemo(
    () => ({
      staffList,
      setStaffList,
      selectedStaffId,
      selectedStaff,
      setSelectedStaffId,
      needsStaffPicker,
    }),
    [
      staffList,
      selectedStaffId,
      selectedStaff,
      setSelectedStaffId,
      needsStaffPicker,
    ],
  );

  return (
    <StaffModuleSelectionContext.Provider value={value}>
      {children}
    </StaffModuleSelectionContext.Provider>
  );
}

export function useStaffModuleSelection() {
  const ctx = React.useContext(StaffModuleSelectionContext);
  if (!ctx) {
    throw new Error(
      "useStaffModuleSelection must be used within StaffModuleSelectionProvider",
    );
  }
  return ctx;
}

export function useStaffModuleSelectionOptional() {
  return React.useContext(StaffModuleSelectionContext);
}

/** @deprecated Import from `@/lib/staff/staff-select-options` instead. */
export function staffOptionLabel(row: RestaurantStaffRow): string {
  return staffSelectOptionLabel(row);
}
