"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { isMissingSchemaError } from "@/lib/supabase/schema-error";
import {
  deleteChecklistArea,
  insertChecklistArea,
  loadChecklistAreas,
  reorderChecklistAreas,
  updateChecklistArea,
} from "@/lib/supabase/checklist-areas-devices-db";
import type { ChecklistAreaDefinition } from "@/lib/types/checklist-areas-devices";
import { CHECKLIST_AREA_DEFAULT_COLOR } from "@/lib/types/checklist-areas-devices";

const HEX = /^#[0-9A-Fa-f]{6}$/;

function normalizeArea(a: ChecklistAreaDefinition): ChecklistAreaDefinition {
  return {
    ...a,
    active: a.active !== false,
    backgroundColor: HEX.test(a.backgroundColor)
      ? a.backgroundColor
      : CHECKLIST_AREA_DEFAULT_COLOR,
  };
}

export function useChecklistAreasStorage(restaurantId: string | null) {
  const [items, setItems] = useState<ChecklistAreaDefinition[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  const reload = useCallback(async () => {
    if (!restaurantId) {
      setItems([]);
      setIsHydrated(true);
      return;
    }
    const { data, error } = await loadChecklistAreas(restaurantId);
    if (error && !isMissingSchemaError(error)) toast.error(error);
    setItems(data.map(normalizeArea));
    setIsHydrated(true);
  }, [restaurantId]);

  useEffect(() => {
    setIsHydrated(false);
    void reload();
  }, [reload]);

  const add = useCallback(
    async (
      name: string,
      active = true,
      backgroundColor = CHECKLIST_AREA_DEFAULT_COLOR,
    ): Promise<{ id: string; name: string } | null> => {
      if (!restaurantId) return null;
      const trimmed = name.trim();
      if (!trimmed) return null;
      const ins = await insertChecklistArea(
        restaurantId,
        trimmed,
        active,
        backgroundColor,
      );
      if (!ins) {
        toast.error("Bereich konnte nicht gespeichert werden.");
        return null;
      }
      setItems((prev) => [
        ...prev,
        normalizeArea({
          id: ins.id,
          name: trimmed,
          active,
          backgroundColor,
        }),
      ]);
      toast.success("Bereich angelegt");
      return { id: ins.id, name: trimmed };
    },
    [restaurantId],
  );

  const update = useCallback(
    async (
      id: string,
      updates: { name?: string; active?: boolean; backgroundColor?: string },
    ) => {
      const ok = await updateChecklistArea(id, updates);
      if (!ok) {
        toast.error("Bereich konnte nicht gespeichert werden.");
        return;
      }
      setItems((prev) =>
        prev.map((a) =>
          a.id === id
            ? normalizeArea({
                ...a,
                name: updates.name ?? a.name,
                active: updates.active ?? a.active,
                backgroundColor: updates.backgroundColor ?? a.backgroundColor,
              })
            : a,
        ),
      );
      toast.success("Bereich gespeichert");
    },
    [],
  );

  const reorder = useCallback(async (next: ChecklistAreaDefinition[]) => {
    const ok = await reorderChecklistAreas(next.map((x) => x.id));
    if (!ok) {
      toast.error("Reihenfolge konnte nicht gespeichert werden.");
      return;
    }
    setItems(next.map(normalizeArea));
  }, []);

  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      if (!restaurantId) return false;
      const ok = await deleteChecklistArea(restaurantId, id);
      if (!ok) {
        toast.error("Bereich konnte nicht gelöscht werden.");
        return false;
      }
      setItems((prev) => prev.filter((a) => a.id !== id));
      toast.success("Bereich gelöscht");
      return true;
    },
    [restaurantId],
  );

  const getById = useCallback(
    (id: string) => items.find((a) => a.id === id),
    [items],
  );

  return { items, isHydrated, reload, add, update, reorder, remove, getById };
}
