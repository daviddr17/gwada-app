"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { INGREDIENT_STORAGE_KEY } from "@/lib/constants/inventory-storage";
import { createId } from "@/lib/create-id";
import { isSupabaseOnlyMode } from "@/lib/constants/database-mode";
import { SEED_INGREDIENTS } from "@/lib/data/inventory-seeds";
import {
  getModuleCacheGcTime,
  getModuleCacheStaleTime,
} from "@/lib/dashboard/module-data-cache-policy";
import {
  fetchIngredientsForRestaurant,
  peekIngredientsCache,
} from "@/lib/inventory/ingredients-query";
import { dispatchDashboardInventoryLivePatchFromCache } from "@/lib/dashboard/dispatch-dashboard-inventory-live-patch-from-cache";
import { toastStorageError } from "@/lib/persist-notify";
import { invalidateInventoryQueries } from "@/lib/query/module-query-invalidation";
import { queryKeys } from "@/lib/query/query-keys";
import { toastDatabaseUnavailable } from "@/lib/supabase/db-toast";
import {
  inventoryRelationalPersistenceEnabled,
  saveIngredientsRelational,
} from "@/lib/supabase/inventory-db";
import {
  getWorkspaceRestaurantId,
  loadWorkspaceJsonLocal,
  mirrorWorkspaceJsonLocal,
} from "@/lib/supabase/workspace-persistence";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import type { Ingredient, NewIngredient } from "@/lib/types/inventory";
import type {
  IngredientStockLogDeliveryReverted,
  IngredientStockLogEntry,
  IngredientStockLogFromDelivery,
  IngredientStockLogFromInvoice,
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

  if (raw.kind === "stock_from_invoice") {
    if (
      typeof raw.fromQuantity !== "number" ||
      typeof raw.toQuantity !== "number" ||
      Number.isNaN(raw.fromQuantity) ||
      Number.isNaN(raw.toQuantity)
    )
      return null;
    if (typeof raw.unitId !== "string" || typeof raw.unitLabel !== "string") return null;
    if (typeof raw.invoiceId !== "string" || typeof raw.articleName !== "string") return null;
    const e: IngredientStockLogFromInvoice = {
      id: raw.id,
      at: raw.at,
      userFirstName,
      userLastName,
      ...(userSource ? { userSource } : {}),
      kind: "stock_from_invoice",
      fromQuantity: raw.fromQuantity,
      toQuantity: raw.toQuantity,
      unitId: raw.unitId,
      unitLabel: raw.unitLabel,
      invoiceId: raw.invoiceId,
      voucherNumber:
        typeof raw.voucherNumber === "string" ? raw.voucherNumber : null,
      articleName: raw.articleName,
    };
    return e;
  }

  if (raw.kind === "stock_from_invoice_correction") {
    if (
      typeof raw.fromQuantity !== "number" ||
      typeof raw.toQuantity !== "number" ||
      Number.isNaN(raw.fromQuantity) ||
      Number.isNaN(raw.toQuantity)
    )
      return null;
    if (typeof raw.unitId !== "string" || typeof raw.unitLabel !== "string") return null;
    if (
      typeof raw.invoiceId !== "string" ||
      typeof raw.correctsInvoiceId !== "string" ||
      typeof raw.articleName !== "string"
    )
      return null;
    const e: import("@/lib/types/ingredient-stock-log").IngredientStockLogFromInvoiceCorrection =
      {
        id: raw.id,
        at: raw.at,
        userFirstName,
        userLastName,
        ...(userSource ? { userSource } : {}),
        kind: "stock_from_invoice_correction",
        fromQuantity: raw.fromQuantity,
        toQuantity: raw.toQuantity,
        unitId: raw.unitId,
        unitLabel: raw.unitLabel,
        invoiceId: raw.invoiceId,
        correctsInvoiceId: raw.correctsInvoiceId,
        voucherNumber:
          typeof raw.voucherNumber === "string" ? raw.voucherNumber : null,
        originalVoucherNumber:
          typeof raw.originalVoucherNumber === "string"
            ? raw.originalVoucherNumber
            : null,
        articleName: raw.articleName,
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
  const lowStockThreshold =
    typeof raw.lowStockThreshold === "number" &&
    Number.isFinite(raw.lowStockThreshold)
      ? raw.lowStockThreshold
      : 0;

  let purchaseUnitPrice: number | null = null;
  if (raw.purchaseUnitPrice != null && raw.purchaseUnitPrice !== "") {
    const p =
      typeof raw.purchaseUnitPrice === "number"
        ? raw.purchaseUnitPrice
        : Number.parseFloat(String(raw.purchaseUnitPrice).replace(",", "."));
    if (Number.isFinite(p) && p >= 0) purchaseUnitPrice = p;
  }

  return {
    id: raw.id,
    name: raw.name,
    unit: raw.unit,
    currentStock: raw.currentStock,
    lowStockThreshold,
    purchaseUnitPrice,
    lastPriceChangeAt:
      typeof raw.lastPriceChangeAt === "string" ? raw.lastPriceChangeAt : null,
    supplierId: raw.supplierId,
    categoryId: raw.categoryId,
    productionSiteId: raw.productionSiteId,
    brandId: raw.brandId,
    active: raw.active === false ? false : true,
    stockLog: parseStockLogArray(raw.stockLog),
  };
}

function parseIngredientsFromUnknown(parsed: unknown): Ingredient[] | null {
  if (!Array.isArray(parsed)) return null;
  const out: Ingredient[] = [];
  for (const row of parsed) {
    if (!row || typeof row !== "object") continue;
    const n = normalizeIngredient(row as Record<string, unknown>);
    if (n) out.push(n);
  }
  return out.length ? out : null;
}

function loadFromStorage(): Ingredient[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(INGREDIENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return parseIngredientsFromUnknown(parsed);
  } catch {
    return null;
  }
}

export type UpdateIngredientOptions = {
  stockActor?: OrderProtocolActor;
  stockUnitLabel?: string;
  skipStockLog?: boolean;
  stockFromDelivery?: { orderId: string; supplierName: string };
  stockDeliveryRevert?: { orderId: string; supplierName: string };
};

export function useIngredientsStorage(options?: { enabled?: boolean }) {
  const queryClient = useQueryClient();
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const supabaseOnly = isSupabaseOnlyMode();
  const failSave = supabaseOnly ? toastDatabaseUnavailable : toastStorageError;
  const useDbInventory = inventoryRelationalPersistenceEnabled();
  const queryEnabled = options?.enabled !== false;

  const [localIngredients, setLocalIngredients] = useState<Ingredient[]>(() =>
    supabaseOnly ? [] : [...SEED_INGREDIENTS],
  );
  const [isLocalHydrated, setIsLocalHydrated] = useState(!useDbInventory);
  const updateSaveToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const ingredientsQuery = useQuery({
    queryKey: queryKeys.inventory.ingredients(restaurantId ?? ""),
    queryFn: fetchIngredientsForRestaurant,
    enabled:
      queryEnabled &&
      useDbInventory &&
      workspaceReady &&
      Boolean(restaurantId),
    staleTime: getModuleCacheStaleTime("inventoryModule") ?? 60_000,
    gcTime: getModuleCacheGcTime("inventoryModule") ?? 5 * 60_000,
    placeholderData: (previous) =>
      previous ?? peekIngredientsCache() ?? undefined,
  });

  const afterInventoryMutation = useCallback(
    (options?: { stockChanged?: boolean }) => {
      if (restaurantId) {
        invalidateInventoryQueries(queryClient, restaurantId, options);
        dispatchDashboardInventoryLivePatchFromCache(restaurantId);
      }
    },
    [queryClient, restaurantId],
  );

  useEffect(() => {
    let cancelled = false;
    if (useDbInventory) {
      return () => {
        cancelled = true;
      };
    }

    if (supabaseOnly) {
      if (cancelled) return;
      setLocalIngredients([]);
      setIsLocalHydrated(true);
      return () => {
        cancelled = true;
      };
    }

    const fromLocal = parseIngredientsFromUnknown(
      loadWorkspaceJsonLocal(INGREDIENT_STORAGE_KEY),
    );
    const next = fromLocal ?? peekIngredientsCache();
    if (next?.length) {
      mirrorWorkspaceJsonLocal(INGREDIENT_STORAGE_KEY, next);
    }
    if (cancelled) return;
    requestAnimationFrame(() => {
      if (cancelled) return;
      if (next && next.length) setLocalIngredients(next);
      setIsLocalHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, [supabaseOnly, useDbInventory]);

  const ingredients = useDbInventory
    ? (ingredientsQuery.data ?? peekIngredientsCache() ?? [])
    : localIngredients;
  const isHydrated = useDbInventory
    ? workspaceReady &&
      (ingredientsQuery.isSuccess ||
        ingredientsQuery.isError ||
        Boolean(peekIngredientsCache()?.length))
    : isLocalHydrated;

  useEffect(
    () => () => {
      if (updateSaveToastTimerRef.current) {
        clearTimeout(updateSaveToastTimerRef.current);
      }
    },
    [],
  );

  const persist = useCallback(
    async (
      next: Ingredient[],
      toastKind?: "add" | "remove" | "update",
      options?: { stockChanged?: boolean },
    ): Promise<boolean> => {
      if (useDbInventory) {
        const rid = restaurantId ?? (await getWorkspaceRestaurantId());
        if (!rid) {
          failSave();
          return false;
        }
        const ok = await saveIngredientsRelational(rid, next);
        if (!ok) {
          failSave();
          return false;
        }
        queryClient.setQueryData(queryKeys.inventory.ingredients(rid), next);
        mirrorWorkspaceJsonLocal(INGREDIENT_STORAGE_KEY, next);
        afterInventoryMutation({
          stockChanged: options?.stockChanged ?? toastKind === "update",
        });
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
      }

      return new Promise((resolve) => {
        setLocalIngredients((prev) => {
          void (async () => {
            const ok = mirrorWorkspaceJsonLocal(INGREDIENT_STORAGE_KEY, next);
            if (!ok) {
              setLocalIngredients(prev);
              failSave();
              resolve(false);
              return;
            }
            if (restaurantId) {
              dispatchDashboardInventoryLivePatchFromCache(restaurantId);
            }
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
            resolve(true);
          })();
          return next;
        });
      });
    },
    [afterInventoryMutation, failSave, queryClient, restaurantId, useDbInventory],
  );

  const addIngredient = useCallback(
    async (row: NewIngredient): Promise<Ingredient | null> => {
      const id = createId();
      const next: Ingredient = {
        ...row,
        id,
        active: row.active !== false,
        stockLog: row.stockLog ?? [],
      };
      const ok = await persist([...ingredients, next], "add");
      return ok ? next : null;
    },
    [ingredients, persist],
  );

  const updateIngredient = useCallback(
    async (
      id: string,
      patch: Partial<Ingredient>,
      opts?: UpdateIngredientOptions,
    ): Promise<boolean> => {
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
          id: createId(),
          at: new Date().toISOString(),
          userFirstName: opts.stockActor.firstName.trim(),
          userLastName: opts.stockActor.lastName.trim(),
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
        const priceChanged =
          patch.purchaseUnitPrice !== undefined &&
          patch.purchaseUnitPrice !== prev.purchaseUnitPrice;
        return {
          ...x,
          ...patch,
          id,
          stockLog,
          lastPriceChangeAt: priceChanged
            ? new Date().toISOString()
            : x.lastPriceChangeAt,
          active:
            patch.active !== undefined
              ? patch.active !== false
              : x.active !== false,
        };
      });

      const stockChanged =
        patch.currentStock !== undefined ||
        patch.lowStockThreshold !== undefined;
      return persist(mapped, "update", { stockChanged });
    },
    [ingredients, persist],
  );

  const removeIngredient = useCallback(
    async (id: string) => {
      await persist(ingredients.filter((x) => x.id !== id), "remove");
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
