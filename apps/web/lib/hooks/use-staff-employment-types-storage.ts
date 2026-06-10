"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  insertStaffEmploymentType,
  loadStaffEmploymentTypes,
  reorderStaffEmploymentTypes,
  seedStaffEmploymentTypesIfEmpty,
  updateStaffEmploymentType,
} from "@/lib/supabase/staff-db";
import type { StaffEmploymentTypeDefinition } from "@/lib/types/staff";

function normalizeItem(
  t: StaffEmploymentTypeDefinition,
): StaffEmploymentTypeDefinition {
  return {
    ...t,
    active: t.active !== false,
  };
}

export function useStaffEmploymentTypesStorage(restaurantId: string | null) {
  const [items, setItems] = useState<StaffEmploymentTypeDefinition[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  const reload = useCallback(async () => {
    if (!restaurantId) {
      setItems([]);
      setIsHydrated(true);
      return;
    }
    await seedStaffEmploymentTypesIfEmpty(restaurantId);
    const { data, error } = await loadStaffEmploymentTypes(restaurantId);
    if (error) toast.error(error);
    setItems(data.map(normalizeItem));
    setIsHydrated(true);
  }, [restaurantId]);

  useEffect(() => {
    setIsHydrated(false);
    void reload();
  }, [reload]);

  const add = useCallback(
    async (name: string, active = true): Promise<{ id: string; name: string } | null> => {
      if (!restaurantId) return null;
      const trimmed = name.trim();
      if (!trimmed) return null;
      const ins = await insertStaffEmploymentType(restaurantId, trimmed, active);
      if (!ins) {
        toast.error("Beschäftigungsverhältnis konnte nicht gespeichert werden.");
        return null;
      }
      setItems((prev) => [...prev, normalizeItem({ id: ins.id, name: trimmed, active })]);
      toast.success("Beschäftigungsverhältnis angelegt");
      return { id: ins.id, name: trimmed };
    },
    [restaurantId],
  );

  const update = useCallback(
    async (id: string, updates: { name?: string; active?: boolean }) => {
      const ok = await updateStaffEmploymentType(id, updates);
      if (!ok) {
        toast.error("Beschäftigungsverhältnis konnte nicht gespeichert werden.");
        return;
      }
      setItems((prev) =>
        prev.map((t) =>
          t.id === id
            ? normalizeItem({
                ...t,
                name: updates.name ?? t.name,
                active: updates.active ?? t.active,
              })
            : t,
        ),
      );
      toast.success("Beschäftigungsverhältnis gespeichert");
    },
    [],
  );

  const reorder = useCallback(async (next: StaffEmploymentTypeDefinition[]) => {
    const ok = await reorderStaffEmploymentTypes(next.map((x) => x.id));
    if (!ok) {
      toast.error("Reihenfolge konnte nicht gespeichert werden.");
      return;
    }
    setItems(next.map(normalizeItem));
  }, []);

  const getById = useCallback(
    (id: string) => items.find((t) => t.id === id),
    [items],
  );

  const activeItems = useMemo(
    () => items.filter((t) => t.active),
    [items],
  );

  return {
    items,
    activeItems,
    isHydrated,
    reload,
    add,
    update,
    reorder,
    getById,
  };
}
