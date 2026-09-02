"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { RestaurantStaffRow } from "@/lib/types/staff";
import { pickStoredActiveStaffId } from "@/lib/staff/staff-select-options";

const STORAGE_KEY = "gwada-staff-module-selected";

function parseStaffSearchParam(raw: string | null): string[] {
  if (!raw?.trim()) return [];
  return [
    ...new Set(
      raw
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ];
}

function serializeStaffSearchParam(ids: readonly string[]): string | null {
  const cleaned = [
    ...new Set(ids.map((id) => id.trim()).filter(Boolean)),
  ];
  return cleaned.length > 0 ? cleaned.join(",") : null;
}

function writeStaffStorage(ids: readonly string[]) {
  try {
    const serialized = serializeStaffSearchParam(ids);
    if (serialized) sessionStorage.setItem(STORAGE_KEY, serialized);
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function readStaffStorage(): string[] {
  try {
    return parseStaffSearchParam(sessionStorage.getItem(STORAGE_KEY));
  } catch {
    return [];
  }
}

type StaffModuleSelectionContextValue = {
  staffList: RestaurantStaffRow[];
  setStaffList: React.Dispatch<React.SetStateAction<RestaurantStaffRow[]>>;
  /** 0 = alle; 1 = Detailansicht; 2+ = gefilterte Übersicht. */
  selectedStaffIds: string[];
  /** Kompatibilität: nur gesetzt wenn genau ein Mitarbeiter gewählt. */
  selectedStaffId: string | null;
  selectedStaff: RestaurantStaffRow | null;
  setSelectedStaffIds: (ids: string[]) => void;
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

  const urlStaffIds = React.useMemo(
    () => parseStaffSearchParam(searchParams.get("staff")),
    [searchParams],
  );

  /** Optimistic lokal — URL nachziehen, damit das Dropdown sofort reagiert. */
  const [selectedStaffIds, setSelectedStaffIdsState] = React.useState<string[]>(
    () => urlStaffIds,
  );

  React.useEffect(() => {
    setSelectedStaffIdsState((prev) => {
      if (
        prev.length === urlStaffIds.length &&
        prev.every((id, i) => id === urlStaffIds[i])
      ) {
        return prev;
      }
      return urlStaffIds;
    });
  }, [urlStaffIds]);

  const selectedStaffId =
    selectedStaffIds.length === 1 ? (selectedStaffIds[0] ?? null) : null;

  const selectedStaff = React.useMemo(
    () => staffList.find((s) => s.id === selectedStaffId) ?? null,
    [staffList, selectedStaffId],
  );

  const syncUrl = React.useCallback(
    (ids: string[]) => {
      const params = new URLSearchParams(searchParams.toString());
      const serialized = serializeStaffSearchParam(ids);
      if (serialized) params.set("staff", serialized);
      else params.delete("staff");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const setSelectedStaffIds = React.useCallback(
    (ids: string[]) => {
      const next = [
        ...new Set(ids.map((id) => id.trim()).filter(Boolean)),
      ];
      setSelectedStaffIdsState(next);
      writeStaffStorage(next);
      syncUrl(next);
    },
    [syncUrl],
  );

  const setSelectedStaffId = React.useCallback(
    (id: string | null) => {
      setSelectedStaffIds(id ? [id] : []);
    },
    [setSelectedStaffIds],
  );

  React.useEffect(() => {
    const skipAutoSelect =
      pathname.startsWith("/dashboard/mitarbeiter/vertraege") ||
      pathname.startsWith("/dashboard/mitarbeiter/dokumente") ||
      pathname.startsWith("/dashboard/mitarbeiter/arbeitszeiten");
    if (
      !needsStaffPicker ||
      selectedStaffIds.length > 0 ||
      staffList.length === 0 ||
      skipAutoSelect
    ) {
      return;
    }
    const stored = readStaffStorage();
    if (stored.length > 1) {
      const activeStored = stored.filter((id) =>
        staffList.some((s) => s.id === id && s.is_active),
      );
      if (activeStored.length > 0) {
        setSelectedStaffIds(activeStored);
        return;
      }
    }
    const storedSingle = stored.length === 1 ? stored[0]! : null;
    const fallback = pickStoredActiveStaffId(staffList, storedSingle);
    if (fallback) setSelectedStaffIds([fallback]);
  }, [
    needsStaffPicker,
    pathname,
    selectedStaffIds.length,
    staffList,
    setSelectedStaffIds,
  ]);

  const selectedStaffIdsKey = selectedStaffIds.join(",");

  React.useEffect(() => {
    const singleStaffSubRoute =
      pathname.startsWith("/dashboard/mitarbeiter/arbeitszeiten/abrechnung") ||
      pathname.startsWith("/dashboard/mitarbeiter/arbeitszeiten/beheben");
    if (singleStaffSubRoute && selectedStaffIds.length > 1) {
      setSelectedStaffIds([selectedStaffIds[0]!]);
    }
  }, [pathname, selectedStaffIdsKey, setSelectedStaffIds]);

  React.useEffect(() => {
    if (!needsStaffPicker || selectedStaffIds.length === 0 || staffList.length === 0) {
      return;
    }
    const activeIds = selectedStaffIds.filter((id) => {
      const row = staffList.find((s) => s.id === id);
      return row?.is_active !== false;
    });
    if (activeIds.length === selectedStaffIds.length) return;
    setSelectedStaffIds(activeIds);
    // selectedStaffIdsKey keeps this stable when contents unchanged after filter
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key encodes ids
  }, [
    needsStaffPicker,
    selectedStaffIdsKey,
    staffList,
    setSelectedStaffIds,
  ]);

  const value = React.useMemo(
    () => ({
      staffList,
      setStaffList,
      selectedStaffIds,
      selectedStaffId,
      selectedStaff,
      setSelectedStaffIds,
      setSelectedStaffId,
      needsStaffPicker,
    }),
    [
      staffList,
      selectedStaffIds,
      selectedStaffId,
      selectedStaff,
      setSelectedStaffIds,
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
