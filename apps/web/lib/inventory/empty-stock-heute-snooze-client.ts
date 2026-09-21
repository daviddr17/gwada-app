"use client";

import { useEffect, useMemo, useState } from "react";
import type { Ingredient } from "@/lib/types/inventory";

export const GWADA_EMPTY_STOCK_HEUTE_SNOOZE_CHANGED_EVENT =
  "gwada:empty-stock-heute-snooze-changed";

const snoozesByRestaurant = new Map<string, Set<string>>();

function notifyEmptyStockHeuteSnoozeChanged(restaurantId: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(GWADA_EMPTY_STOCK_HEUTE_SNOOZE_CHANGED_EVENT, {
      detail: { restaurantId },
    }),
  );
}

export function peekEmptyStockHeuteSnoozedIds(restaurantId: string | null): Set<string> {
  if (!restaurantId) return new Set();
  return new Set(snoozesByRestaurant.get(restaurantId) ?? []);
}

export function setEmptyStockHeuteSnoozedIds(
  restaurantId: string,
  ingredientIds: readonly string[],
): void {
  snoozesByRestaurant.set(restaurantId, new Set(ingredientIds));
  notifyEmptyStockHeuteSnoozeChanged(restaurantId);
}

export function addEmptyStockHeuteSnooze(
  restaurantId: string,
  ingredientId: string,
): void {
  const next = new Set(snoozesByRestaurant.get(restaurantId) ?? []);
  next.add(ingredientId);
  snoozesByRestaurant.set(restaurantId, next);
  notifyEmptyStockHeuteSnoozeChanged(restaurantId);
}

export function removeEmptyStockHeuteSnooze(
  restaurantId: string,
  ingredientId: string,
): void {
  const current = snoozesByRestaurant.get(restaurantId);
  if (!current?.has(ingredientId)) return;
  const next = new Set(current);
  next.delete(ingredientId);
  snoozesByRestaurant.set(restaurantId, next);
  notifyEmptyStockHeuteSnoozeChanged(restaurantId);
}

/** Nach Auffüllung (>0) ist der DB-Snooze weg — Client-Cache bereinigen. */
export function pruneEmptyStockHeuteSnoozesForIngredients(
  restaurantId: string,
  ingredients: readonly Pick<Ingredient, "id" | "currentStock">[],
): void {
  const current = snoozesByRestaurant.get(restaurantId);
  if (!current?.size) return;
  const stockById = new Map(ingredients.map((i) => [i.id, i.currentStock]));
  let changed = false;
  for (const id of current) {
    const stock = stockById.get(id);
    if (stock === undefined || stock > 0) {
      current.delete(id);
      changed = true;
    }
  }
  if (changed) notifyEmptyStockHeuteSnoozeChanged(restaurantId);
}

export function useEmptyStockHeuteSnoozedIds(restaurantId: string | null): Set<string> {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const onChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ restaurantId?: string }>).detail;
      if (!restaurantId || detail?.restaurantId === restaurantId) {
        setVersion((v) => v + 1);
      }
    };
    window.addEventListener(GWADA_EMPTY_STOCK_HEUTE_SNOOZE_CHANGED_EVENT, onChanged);
    return () =>
      window.removeEventListener(
        GWADA_EMPTY_STOCK_HEUTE_SNOOZE_CHANGED_EVENT,
        onChanged,
      );
  }, [restaurantId]);

  return useMemo(
    () => peekEmptyStockHeuteSnoozedIds(restaurantId),
    [restaurantId, version],
  );
}
