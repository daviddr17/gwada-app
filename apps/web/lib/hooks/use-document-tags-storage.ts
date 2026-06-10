"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  deleteDocumentTag,
  insertDocumentTag,
  loadDocumentTags,
  reorderDocumentTags,
  updateDocumentTag,
} from "@/lib/supabase/documents-db";
import type { DocumentTagDefinition } from "@/lib/types/documents";

const HEX = /^#[0-9A-Fa-f]{6}$/;

function normalizeColor(hex: string | undefined): string {
  if (hex && HEX.test(hex)) return hex;
  return "#64748b";
}

function normalizeTag(t: DocumentTagDefinition): DocumentTagDefinition {
  return {
    ...t,
    active: t.active !== false,
    backgroundColor: normalizeColor(t.backgroundColor),
  };
}

export function useDocumentTagsStorage(restaurantId: string | null) {
  const [items, setItems] = useState<DocumentTagDefinition[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  const reload = useCallback(async () => {
    if (!restaurantId) {
      setItems([]);
      setIsHydrated(true);
      return;
    }
    const { data, error } = await loadDocumentTags(restaurantId);
    if (error) toast.error(error);
    setItems(data.map(normalizeTag));
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
      backgroundColor = "#64748b",
    ): Promise<{ id: string; name: string } | null> => {
      if (!restaurantId) return null;
      const trimmed = name.trim();
      if (!trimmed) return null;
      const color = normalizeColor(backgroundColor);
      const ins = await insertDocumentTag(
        restaurantId,
        trimmed,
        active,
        color,
      );
      if (!ins) {
        toast.error("Tag konnte nicht gespeichert werden.");
        return null;
      }
      setItems((prev) => [
        ...prev,
        normalizeTag({
          id: ins.id,
          name: trimmed,
          active,
          backgroundColor: color,
        }),
      ]);
      toast.success("Tag angelegt");
      return { id: ins.id, name: trimmed };
    },
    [restaurantId],
  );

  const update = useCallback(
    async (
      id: string,
      updates: {
        name?: string;
        active?: boolean;
        backgroundColor?: string;
      },
    ) => {
      const ok = await updateDocumentTag(id, updates);
      if (!ok) {
        toast.error("Tag konnte nicht gespeichert werden.");
        return;
      }
      setItems((prev) =>
        prev.map((t) =>
          t.id === id
            ? normalizeTag({
                ...t,
                name: updates.name ?? t.name,
                active: updates.active ?? t.active,
                backgroundColor: updates.backgroundColor ?? t.backgroundColor,
              })
            : t,
        ),
      );
      toast.success("Tag gespeichert");
    },
    [],
  );

  const reorder = useCallback(async (next: DocumentTagDefinition[]) => {
    const ok = await reorderDocumentTags(next.map((x) => x.id));
    if (!ok) {
      toast.error("Reihenfolge konnte nicht gespeichert werden.");
      return;
    }
    setItems(next.map(normalizeTag));
  }, []);

  const getById = useCallback(
    (id: string) => items.find((t) => t.id === id),
    [items],
  );

  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      const ok = await deleteDocumentTag(id);
      if (!ok) {
        toast.error("Tag konnte nicht gelöscht werden.");
        return false;
      }
      setItems((prev) => prev.filter((t) => t.id !== id));
      toast.success("Tag gelöscht");
      return true;
    },
    [],
  );

  return {
    items,
    isHydrated,
    reload,
    add,
    update,
    reorder,
    remove,
    getById,
  };
}
