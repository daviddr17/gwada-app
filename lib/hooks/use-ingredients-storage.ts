"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { INGREDIENT_STORAGE_KEY } from "@/lib/constants/inventory-storage";
import { SEED_INGREDIENTS } from "@/lib/data/inventory-seeds";
import { toastStorageError } from "@/lib/persist-notify";
import type { Ingredient, NewIngredient } from "@/lib/types/inventory";
import type {
  IngredientStockLogDeliveryReverted,
  IngredientStockLogEntry,
  IngredientStockLogFromDelivery,
  IngredientStockLogManual,
} from "@/lib/types/ingredient-stock-log";
import type { OrderProtocolActor } from "@/lib/types/purchase-order";

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

function parseStockLogEntry(raw: unknown): IngredientStockLogEntry | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.id !== "string" || typeof raw.at !== "string") return null;
  const userFirstName = typeof raw.userFirstName === "string" ? raw.userFirstName : "";
  const userLastName = typeof raw.userLastName === "string" ? raw.userLastName : "";
  const userSource =
    raw.userSource === "local_profile" ? ("local_profile" as const) : undefined;

  if (raw.kind === "manual_stock") {
    if (
      typeof raw.fromQuantity !== "number" ||
      typeof raw.toQuantity !== "number" ||
      Number.isNaN(raw.fromQuantity) ||
      Number.isNaN(raw.toQuantity)
    )
      return null;
    if (typeof raw.unitId !== "string" || typeof raw.unitLabel !== "string") return null;
    const e: IngredientStockLogManual = {
      id: raw.id,
      at: raw.at,
      userFirstName,
      userLastName,
      ...(userSource ? { userSource } : {}),
      kind: "manual_stock",
      fromQuantity: raw.fromQuantity,
      toQuantity: raw.toQuantity,
      unitId: raw.unitId,
      unitLabel: raw.unitLabel,
    };
    return e;
  }

  if (raw.kind === "stock_from_delivery") {
    if (
      typeof raw.fromQuantity !== "number" ||
      typeof raw.toQuantity !== "number" ||
      Number.isNaN(raw.fromQuantity) ||
      Number.isNaN(raw.toQuantity)
    )
      return null;
    if (typeof raw.unitId !== "string" || typeof raw.unitLabel !== "string") return null;
    if (typeof raw.orderId !== "string" || typeof raw.supplierName !== "string") return null;
    const e: IngredientStockLogFromDelivery = {
      id: raw.id,
      at: raw.at,
      userFirstName,
      userLastName,
      ...(userSource ? { userSource } : {}),
      kind: "stock_from_delivery",
      fromQuantity: raw.fromQuantity,
      toQuantity: raw.toQuantity,
      unitId: raw.unitId,
      unitLabel: raw.unitLabel,
      orderId: raw.orderId,
      supplierName: raw.supplierName,
    };
    return e;
  }

  if (raw.kind === "stock_delivery_reverted") {
    if (
      typeof raw.fromQuantity !== "number" ||
      typeof raw.toQuantity !== "number" ||
      Number.isNaN(raw.fromQuantity) ||
      Number.isNaN(raw.toQuantity)
    )
      return null;
    if (typeof raw.unitId !== "string" || typeof raw.unitLabel !== "string") return null;
    if (typeof raw.orderId !== "string" || typeof raw.supplierName !== "string") return null;
    const e: IngredientStockLogDeliveryReverted = {
      id: raw.id,
      at: raw.at,
      userFirstName,
      userLastName,
      ...(userSource ? { userSource } : {}),
      kind: "stock_delivery_reverted",
      fromQuantity: raw.fromQuantity,
      toQuantity: raw.toQuantity,
      unitId: raw.unitId,
      unitLabel: raw.unitLabel,
      orderId: raw.orderId,
      supplierName: raw.supplierName,
    };
    return e;
  }

  return null;
}

function parseStockLogArray(raw: unknown): IngredientStockLogEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: IngredientStockLogEntry[] = [];
  for (const row of raw) {
    const e = parseStockLogEntry(row);
    if (e) out.push(e);
  }
  return out;
}

function normalizeIngredient(raw: Record<string, unknown>): Ingredient | null {
  if (
    typeof raw.id !== "string" ||
    typeof raw.name !== "string" ||
    typeof raw.unit !== "string" ||
    raw.unit.length === 0 ||
    typeof raw.currentStock !== "number" ||
    Number.isNaN(raw.currentStock) ||
    typeof raw.supplierId !== "string" ||
    typeof raw.categoryId !== "string" ||
    typeof raw.productionSiteId !== "string" ||
    typeof raw.brandId !== "string"
  ) {
    return null;
  }
  return {
    id: raw.id,
    name: raw.name,
    unit: raw.unit,
    currentStock: raw.currentStock,
    supplierId: raw.supplierId,
    categoryId: raw.categoryId,
    productionSiteId: raw.productionSiteId,
    brandId: raw.brandId,
    active: raw.active === false ? false : true,
    stockLog: parseStockLogArray(raw.stockLog),
  };
}

function loadFromStorage(): Ingredient[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(INGREDIENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const out: Ingredient[] = [];
    for (const row of parsed) {
      if (!row || typeof row !== "object") continue;
      const n = normalizeIngredient(row as Record<string, unknown>);
      if (n) out.push(n);
    }
    return out.length ? out : null;
  } catch {
    return null;
  }
}

export type UpdateIngredientOptions = {
  stockActor?: OrderProtocolActor;
  /** Anzeige-Einheit für das Bestandsprotokoll */
  stockUnitLabel?: string;
  /** Kein Protokolleintrag (z. B. Rollback) */
  skipStockLog?: boolean;
  stockFromDelivery?: { orderId: string; supplierName: string };
  /** Lieferbuchung rückgängig (Bestand reduziert) */
  stockDeliveryRevert?: { orderId: string; supplierName: string };
};

export function useIngredientsStorage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>(() => [
    ...SEED_INGREDIENTS,
  ]);
  const [isHydrated, setIsHydrated] = useState(false);
  const updateSaveToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(() => {
    const stored = loadFromStorage();
    const frame = requestAnimationFrame(() => {
      if (stored) setIngredients(stored);
      setIsHydrated(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(
    () => () => {
      if (updateSaveToastTimerRef.current) {
        clearTimeout(updateSaveToastTimerRef.current);
      }
    },
    [],
  );

  const persist = useCallback(
    (next: Ingredient[], toastKind?: "add" | "remove" | "update"): boolean => {
      try {
        localStorage.setItem(INGREDIENT_STORAGE_KEY, JSON.stringify(next));
        setIngredients(next);
        if (toastKind === "add") {
          toast.success("Zutat angelegt");
        } else if (toastKind === "remove") {
          toast.success("Zutat entfernt");
        } else if (toastKind === "update") {
          if (updateSaveToastTimerRef.current) {
            clearTimeout(updateSaveToastTimerRef.current);
          }
          updateSaveToastTimerRef.current = setTimeout(() => {
            updateSaveToastTimerRef.current = null;
            toast.success("Zutat gespeichert", { id: "ingredient-update" });
          }, 450);
        }
        return true;
      } catch (e) {
        console.error(e);
        toastStorageError();
        return false;
      }
    },
    [],
  );

  const addIngredient = useCallback(
    (row: NewIngredient) => {
      const id = crypto.randomUUID();
      const next: Ingredient = {
        ...row,
        id,
        active: row.active !== false,
        stockLog: row.stockLog ?? [],
      };
      const ok = persist([...ingredients, next], "add");
      return ok ? next : null;
    },
    [ingredients, persist],
  );

  const updateIngredient = useCallback(
    (
      id: string,
      patch: Partial<Ingredient>,
      opts?: UpdateIngredientOptions,
    ): boolean => {
      const prev = ingredients.find((x) => x.id === id);
      if (!prev) return false;

      const nextStock =
        patch.currentStock !== undefined ? patch.currentStock : prev.currentStock;

      let stockLog: IngredientStockLogEntry[] = [...(prev.stockLog ?? [])];

      if (
        patch.currentStock !== undefined &&
        prev.currentStock !== nextStock &&
        !opts?.skipStockLog &&
        opts?.stockActor &&
        opts?.stockUnitLabel
      ) {
        const unitId = patch.unit !== undefined ? patch.unit : prev.unit;
        const base = {
          id: crypto.randomUUID(),
          at: new Date().toISOString(),
          userFirstName: "",
          userLastName: "",
          userSource: "local_profile" as const,
          fromQuantity: prev.currentStock,
          toQuantity: nextStock,
          unitId,
          unitLabel: opts.stockUnitLabel,
        };
        if (opts.stockFromDelivery) {
          stockLog = [
            ...stockLog,
            {
              ...base,
              kind: "stock_from_delivery" as const,
              orderId: opts.stockFromDelivery.orderId,
              supplierName: opts.stockFromDelivery.supplierName,
            },
          ];
        } else if (opts.stockDeliveryRevert) {
          stockLog = [
            ...stockLog,
            {
              ...base,
              kind: "stock_delivery_reverted" as const,
              orderId: opts.stockDeliveryRevert.orderId,
              supplierName: opts.stockDeliveryRevert.supplierName,
            },
          ];
        } else {
          stockLog = [
            ...stockLog,
            {
              ...base,
              kind: "manual_stock" as const,
            },
          ];
        }
      }

      const mapped = ingredients.map((x) => {
        if (x.id !== id) return x;
        return {
          ...x,
          ...patch,
          id,
          stockLog,
          active:
            patch.active !== undefined
              ? patch.active !== false
              : x.active !== false,
        };
      });

      return persist(mapped, "update");
    },
    [ingredients, persist],
  );

  const removeIngredient = useCallback(
    (id: string) => {
      persist(ingredients.filter((x) => x.id !== id), "remove");
    },
    [ingredients, persist],
  );

  return {
    ingredients,
    addIngredient,
    updateIngredient,
    removeIngredient,
    isHydrated,
  };
}
