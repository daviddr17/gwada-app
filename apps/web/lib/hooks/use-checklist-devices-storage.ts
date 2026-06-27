"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { isMissingSchemaError } from "@/lib/supabase/schema-error";
import {
  deleteChecklistDevice,
  fetchChecklistDevices,
  reorderChecklistDevices,
  upsertChecklistDevice,
} from "@/lib/supabase/checklist-areas-devices-db";
import type {
  ChecklistDeviceUpsertInput,
  RestaurantChecklistDeviceRow,
} from "@/lib/types/checklist-areas-devices";

export function useChecklistDevicesStorage(restaurantId: string | null) {
  const [items, setItems] = useState<RestaurantChecklistDeviceRow[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  const reload = useCallback(async () => {
    if (!restaurantId) {
      setItems([]);
      setIsHydrated(true);
      return;
    }
    const { data, error } = await fetchChecklistDevices(restaurantId);
    if (error && !isMissingSchemaError(error)) toast.error(error);
    setItems(data);
    setIsHydrated(true);
  }, [restaurantId]);

  useEffect(() => {
    setIsHydrated(false);
    void reload();
  }, [reload]);

  const upsert = useCallback(
    async (
      input: ChecklistDeviceUpsertInput,
      deviceId?: string | null,
    ): Promise<RestaurantChecklistDeviceRow | null> => {
      if (!restaurantId) return null;
      const { data, error } = await upsertChecklistDevice(
        restaurantId,
        input,
        deviceId,
      );
      if (error || !data) {
        toast.error(error ?? "Gerät konnte nicht gespeichert werden.");
        return null;
      }
      setItems((prev) => {
        const idx = prev.findIndex((d) => d.id === data.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = data;
          return next;
        }
        return [...prev, data];
      });
      toast.success(deviceId ? "Gerät gespeichert" : "Gerät angelegt");
      return data;
    },
    [restaurantId],
  );

  const reorder = useCallback(async (next: RestaurantChecklistDeviceRow[]) => {
    const ok = await reorderChecklistDevices(next.map((d) => d.id));
    if (!ok) {
      toast.error("Reihenfolge konnte nicht gespeichert werden.");
      return;
    }
    setItems(next);
  }, []);

  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      if (!restaurantId) return false;
      const ok = await deleteChecklistDevice(restaurantId, id);
      if (!ok) {
        toast.error("Gerät konnte nicht gelöscht werden.");
        return false;
      }
      setItems((prev) => prev.filter((d) => d.id !== id));
      toast.success("Gerät gelöscht");
      return true;
    },
    [restaurantId],
  );

  const getById = useCallback(
    (id: string) => items.find((d) => d.id === id),
    [items],
  );

  return { items, isHydrated, reload, upsert, reorder, remove, getById };
}
