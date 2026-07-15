"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { PURCHASE_ORDERS_STORAGE_KEY } from "@/lib/constants/inventory-storage";
import { createId } from "@/lib/create-id";
import {
  getModuleCacheGcTime,
  getModuleCacheStaleTime,
} from "@/lib/dashboard/module-data-cache-policy";
import {
  fetchPurchaseOrdersForRestaurant,
  peekPurchaseOrdersCache,
} from "@/lib/inventory/purchase-orders-query";
import { dispatchDashboardInventoryLivePatchFromCache } from "@/lib/dashboard/dispatch-dashboard-inventory-live-patch-from-cache";
import { invalidateInventoryQueries } from "@/lib/query/module-query-invalidation";
import { queryKeys } from "@/lib/query/query-keys";
import {
  toastPurchaseOrderLineAdded,
  toastPurchaseOrderLineRemoved,
  toastPurchaseOrderOpened,
  toastPurchaseOrderQuantityChanged,
  toastPurchaseOrderQuantityIncreased,
} from "@/lib/inventory/purchase-order-notifications";
import { applyTaxonomySupplierNamesToOrders } from "@/lib/inventory/resolve-purchase-order-supplier-name";
import { isSupabaseOnlyMode } from "@/lib/constants/database-mode";
import { toastStorageError } from "@/lib/persist-notify";
import {
  toastDatabaseSaveError,
  toastDatabaseUnavailable,
} from "@/lib/supabase/db-toast";
import {
  inventoryRelationalPersistenceEnabled,
  savePurchaseOrdersRelational,
} from "@/lib/supabase/inventory-db";
import {
  getWorkspaceRestaurantId,
  loadWorkspaceJsonLocal,
  mirrorWorkspaceJsonLocal,
} from "@/lib/supabase/workspace-persistence";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import type { InventoryTaxonomyDefinition } from "@/lib/types/inventory";
import {
  healPurchaseOrdersCreatorAttribution,
  protocolActorNameFields,
  protocolCreatedByLabel,
  type OrderProtocolActor,
  type PurchaseOrder,
  type PurchaseOrderLine,
  type PurchaseOrderLogAdd,
  type PurchaseOrderLogDeliveryReverted,
  type PurchaseOrderLogEntry,
  type PurchaseOrderLogLegacy,
  type PurchaseOrderLogMarkedDelivered,
  type PurchaseOrderLogQuantityChange,
  type PurchaseOrdersPersistenceV1,
} from "@/lib/types/purchase-order";

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

function parseLogEntry(raw: unknown): PurchaseOrderLogEntry | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.id !== "string" || typeof raw.at !== "string") return null;
  if (typeof raw.ingredientId !== "string" || typeof raw.ingredientName !== "string")
    return null;
  if (typeof raw.unitId !== "string" || typeof raw.unitLabel !== "string")
    return null;

  let userFirstName = typeof raw.userFirstName === "string" ? raw.userFirstName : "";
  let userLastName = typeof raw.userLastName === "string" ? raw.userLastName : "";
  if (userFirstName === "" && userLastName === "" && typeof raw.userName === "string") {
    userLastName = raw.userName;
  }

  if (raw.kind === "add_to_order") {
    if (typeof raw.quantity !== "number" || Number.isNaN(raw.quantity) || raw.quantity <= 0)
      return null;
    const userSource =
      raw.userSource === "local_profile" ? ("local_profile" as const) : undefined;
    return {
      id: raw.id,
      at: raw.at,
      userFirstName,
      userLastName,
      ...(userSource ? { userSource } : {}),
      kind: "add_to_order",
      ingredientId: raw.ingredientId,
      ingredientName: raw.ingredientName,
      quantity: raw.quantity,
      unitId: raw.unitId,
      unitLabel: raw.unitLabel,
    } satisfies PurchaseOrderLogAdd;
  }

  if (raw.kind === "quantity_change") {
    if (
      typeof raw.fromQuantity !== "number" ||
      typeof raw.toQuantity !== "number" ||
      Number.isNaN(raw.fromQuantity) ||
      Number.isNaN(raw.toQuantity)
    )
      return null;
    const userSource =
      raw.userSource === "local_profile" ? ("local_profile" as const) : undefined;
    return {
      id: raw.id,
      at: raw.at,
      userFirstName,
      userLastName,
      ...(userSource ? { userSource } : {}),
      kind: "quantity_change",
      ingredientId: raw.ingredientId,
      ingredientName: raw.ingredientName,
      fromQuantity: raw.fromQuantity,
      toQuantity: raw.toQuantity,
      unitId: raw.unitId,
      unitLabel: raw.unitLabel,
    } satisfies PurchaseOrderLogQuantityChange;
  }

  if (raw.kind === "marked_delivered") {
    if (typeof raw.lineId !== "string") return null;
    if (
      typeof raw.quantity !== "number" ||
      Number.isNaN(raw.quantity) ||
      raw.quantity <= 0
    )
      return null;
    const userSource =
      raw.userSource === "local_profile" ? ("local_profile" as const) : undefined;
    return {
      id: raw.id,
      at: raw.at,
      userFirstName,
      userLastName,
      ...(userSource ? { userSource } : {}),
      kind: "marked_delivered",
      ingredientId: raw.ingredientId,
      ingredientName: raw.ingredientName,
      quantity: raw.quantity,
      unitId: raw.unitId,
      unitLabel: raw.unitLabel,
      lineId: raw.lineId,
    } satisfies PurchaseOrderLogMarkedDelivered;
  }

  if (raw.kind === "delivery_reverted") {
    if (typeof raw.lineId !== "string") return null;
    if (
      typeof raw.quantity !== "number" ||
      Number.isNaN(raw.quantity) ||
      raw.quantity <= 0
    )
      return null;
    const userSource =
      raw.userSource === "local_profile" ? ("local_profile" as const) : undefined;
    return {
      id: raw.id,
      at: raw.at,
      userFirstName,
      userLastName,
      ...(userSource ? { userSource } : {}),
      kind: "delivery_reverted",
      ingredientId: raw.ingredientId,
      ingredientName: raw.ingredientName,
      quantity: raw.quantity,
      unitId: raw.unitId,
      unitLabel: raw.unitLabel,
      lineId: raw.lineId,
    } satisfies PurchaseOrderLogDeliveryReverted;
  }

  if (typeof raw.quantityDelta === "number" && !Number.isNaN(raw.quantityDelta)) {
    if (typeof raw.userName !== "string") return null;
    return {
      id: raw.id,
      at: raw.at,
      userName: raw.userName,
      kind: "legacy_adjustment",
      ingredientId: raw.ingredientId,
      ingredientName: raw.ingredientName,
      quantityDelta: raw.quantityDelta,
      unitId: raw.unitId,
      unitLabel: raw.unitLabel,
    } satisfies PurchaseOrderLogLegacy;
  }

  return null;
}

function parseLine(raw: unknown): PurchaseOrderLine | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.id !== "string" || typeof raw.ingredientId !== "string") return null;
  if (typeof raw.ingredientName !== "string") return null;
  if (typeof raw.quantity !== "number" || Number.isNaN(raw.quantity)) return null;
  if (typeof raw.unitId !== "string" || typeof raw.unitLabel !== "string") return null;
  const brandLabel =
    typeof raw.brandLabel === "string" && raw.brandLabel.trim() !== ""
      ? raw.brandLabel
      : undefined;
  let deliveredAt: string | undefined;
  if (typeof raw.deliveredAt === "string" && raw.deliveredAt.length > 0) {
    deliveredAt = raw.deliveredAt;
  }
  return {
    id: raw.id,
    ingredientId: raw.ingredientId,
    ingredientName: raw.ingredientName,
    ...(brandLabel !== undefined ? { brandLabel } : {}),
    quantity: raw.quantity,
    unitId: raw.unitId,
    unitLabel: raw.unitLabel,
    ...(deliveredAt !== undefined ? { deliveredAt } : {}),
  };
}

function parseOrder(raw: unknown): PurchaseOrder | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.id !== "string") return null;
  if (typeof raw.supplierId !== "string" || typeof raw.supplierName !== "string")
    return null;
  if (raw.status !== "open" && raw.status !== "closed") return null;
  const createdByUserSource =
    raw.createdByUserSource === "local_profile" ? ("local_profile" as const) : undefined;
  if (typeof raw.createdAt !== "string" || typeof raw.createdBy !== "string") return null;
  // createdBy darf leer sein (unbekannt / bereinigtes local_profile-Remapping)
  if (!Array.isArray(raw.lines) || !Array.isArray(raw.log)) return null;
  const lines: PurchaseOrderLine[] = [];
  for (const l of raw.lines) {
    const p = parseLine(l);
    if (p) lines.push(p);
  }
  const log: PurchaseOrderLogEntry[] = [];
  for (const e of raw.log) {
    const p = parseLogEntry(e);
    if (p) log.push(p);
  }
  let deliveryDate: string | null = null;
  if (typeof raw.deliveryDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.deliveryDate)) {
    deliveryDate = raw.deliveryDate;
  }
  return {
    id: raw.id,
    supplierId: raw.supplierId,
    supplierName: raw.supplierName,
    status: raw.status,
    createdAt: raw.createdAt,
    createdBy: raw.createdBy,
    ...(createdByUserSource ? { createdByUserSource } : {}),
    deliveryDate,
    lines,
    log,
  };
}

function parseOrdersFromUnknown(parsed: unknown): PurchaseOrder[] {
  if (!isRecord(parsed) || parsed.version !== 1) return [];
  const arr = parsed.orders;
  if (!Array.isArray(arr)) return [];
  const out: PurchaseOrder[] = [];
  for (const o of arr) {
    const p = parseOrder(o);
    if (p) out.push(p);
  }
  return out;
}

function loadFromStorage(): PurchaseOrder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PURCHASE_ORDERS_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return parseOrdersFromUnknown(parsed);
  } catch {
    return [];
  }
}

export type AddPurchaseLineParams = {
  supplierId: string;
  supplierName: string;
  ingredientId: string;
  ingredientName: string;
  brandLabel: string;
  quantity: number;
  unitId: string;
  unitLabel: string;
  actor: OrderProtocolActor;
};

export type OpenLineContext = {
  orderId: string | null;
  lineId: string | null;
  quantity: number;
};

export function usePurchaseOrdersStorage() {
  const queryClient = useQueryClient();
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const supabaseOnly = isSupabaseOnlyMode();
  const failSave = supabaseOnly ? toastDatabaseUnavailable : toastStorageError;
  const useDbInventory = inventoryRelationalPersistenceEnabled();

  const [localOrders, setLocalOrders] = useState<PurchaseOrder[]>([]);
  const [isLocalHydrated, setIsLocalHydrated] = useState(!useDbInventory);

  const ordersQuery = useQuery({
    queryKey: queryKeys.inventory.purchaseOrders(restaurantId ?? ""),
    queryFn: fetchPurchaseOrdersForRestaurant,
    enabled: useDbInventory && workspaceReady && Boolean(restaurantId),
    staleTime: getModuleCacheStaleTime("inventoryModule") ?? 60_000,
    gcTime: getModuleCacheGcTime("inventoryModule") ?? 5 * 60_000,
    placeholderData: (previous) =>
      previous ?? peekPurchaseOrdersCache() ?? undefined,
  });

  const afterOrdersMutation = useCallback(() => {
    if (restaurantId) {
      invalidateInventoryQueries(queryClient, restaurantId);
      dispatchDashboardInventoryLivePatchFromCache(restaurantId);
    }
  }, [queryClient, restaurantId]);

  useEffect(() => {
    let cancelled = false;
    if (useDbInventory) {
      return () => {
        cancelled = true;
      };
    }

    if (supabaseOnly) {
      if (cancelled) return;
      setLocalOrders([]);
      setIsLocalHydrated(true);
      return () => {
        cancelled = true;
      };
    }

    const fromLocal = parseOrdersFromUnknown(
      loadWorkspaceJsonLocal(PURCHASE_ORDERS_STORAGE_KEY),
    );
    const stored = loadFromStorage();
    const next = fromLocal.length > 0 ? fromLocal : stored;
    mirrorWorkspaceJsonLocal(PURCHASE_ORDERS_STORAGE_KEY, {
      version: 1 as const,
      orders: next,
    });
    if (cancelled) return;
    requestAnimationFrame(() => {
      if (cancelled) return;
      setLocalOrders(next);
      setIsLocalHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, [supabaseOnly, useDbInventory]);

  const orders = useDbInventory
    ? (ordersQuery.data ?? peekPurchaseOrdersCache() ?? [])
    : localOrders;
  const isHydrated = useDbInventory
    ? workspaceReady &&
      (ordersQuery.isSuccess ||
        ordersQuery.isError ||
        peekPurchaseOrdersCache().length > 0)
    : isLocalHydrated;

  const persist = useCallback(
    async (next: PurchaseOrder[]): Promise<boolean> => {
      if (useDbInventory) {
        const rid = restaurantId ?? (await getWorkspaceRestaurantId());
        if (!rid) {
          failSave();
          return false;
        }
        const result = await savePurchaseOrdersRelational(rid, next);
        if (!result.ok) {
          toastDatabaseSaveError(result.message);
          return false;
        }
        queryClient.setQueryData(
          queryKeys.inventory.purchaseOrders(rid),
          next,
        );
        mirrorWorkspaceJsonLocal(PURCHASE_ORDERS_STORAGE_KEY, {
          version: 1 as const,
          orders: next,
        });
        afterOrdersMutation();
        return true;
      }
      const payload: PurchaseOrdersPersistenceV1 = { version: 1, orders: next };
      const ok = mirrorWorkspaceJsonLocal(PURCHASE_ORDERS_STORAGE_KEY, payload);
      if (!ok) {
        failSave();
        return false;
      }
      setLocalOrders(next);
      if (restaurantId) {
        dispatchDashboardInventoryLivePatchFromCache(restaurantId);
      }
      return true;
    },
    [afterOrdersMutation, failSave, queryClient, restaurantId, useDbInventory],
  );

  const getOpenLineContext = useCallback(
    (supplierId: string, ingredientId: string): OpenLineContext => {
      if (!supplierId.trim()) {
        return { orderId: null, lineId: null, quantity: 0 };
      }
      const o = orders.find(
        (x) => x.supplierId === supplierId && x.status === "open",
      );
      if (!o) return { orderId: null, lineId: null, quantity: 0 };
      const line = o.lines.find((l) => l.ingredientId === ingredientId);
      if (!line) return { orderId: o.id, lineId: null, quantity: 0 };
      return { orderId: o.id, lineId: line.id, quantity: line.quantity };
    },
    [orders],
  );

  const addLine = useCallback(
    async (params: AddPurchaseLineParams): Promise<boolean> => {
      if (!params.supplierId.trim()) {
        toast.error(
          "Diese Zutat hat keinen gültigen Lieferanten und kann nicht bestellt werden.",
        );
        return false;
      }
      if (!Number.isFinite(params.quantity) || params.quantity <= 0) {
        toast.error("Bitte eine gültige Menge größer 0 eingeben.");
        return false;
      }

      const prev = orders;
      const next: PurchaseOrder[] = structuredClone(prev);
      let order = next.find(
        (o) => o.supplierId === params.supplierId && o.status === "open",
      );
      let createdNewOrder = false;
      if (!order) {
        order = {
          id: createId(),
          supplierId: params.supplierId,
          supplierName: params.supplierName,
          status: "open",
          createdAt: new Date().toISOString(),
          createdBy: protocolCreatedByLabel(params.actor),
          deliveryDate: null,
          lines: [],
          log: [],
        };
        next.push(order);
        createdNewOrder = true;
      } else if (
        params.supplierName.trim() &&
        params.supplierName.trim() !== order.supplierName
      ) {
        // Stammdaten-Klarname nachziehen (z. B. nach Umbenennung / Bubble-Platzhalter).
        order.supplierName = params.supplierName.trim();
      }

      const logEntry: PurchaseOrderLogAdd = {
        id: createId(),
        at: new Date().toISOString(),
        ...protocolActorNameFields(params.actor),
        kind: "add_to_order",
        ingredientId: params.ingredientId,
        ingredientName: params.ingredientName,
        quantity: params.quantity,
        unitId: params.unitId,
        unitLabel: params.unitLabel,
      };
      order.log.push(logEntry);

      const existing = order.lines.find((l) => l.ingredientId === params.ingredientId);
      let addedNewLine = false;
      if (existing) {
        existing.quantity += params.quantity;
        existing.brandLabel = params.brandLabel;
      } else {
        addedNewLine = true;
        order.lines.push({
          id: createId(),
          ingredientId: params.ingredientId,
          ingredientName: params.ingredientName,
          brandLabel: params.brandLabel,
          quantity: params.quantity,
          unitId: params.unitId,
          unitLabel: params.unitLabel,
        });
      }

      const ok = await persist(next);
      if (!ok) return false;

      if (createdNewOrder) {
        toastPurchaseOrderOpened(
          params.supplierName,
          params.ingredientName,
          params.quantity,
          params.unitLabel,
        );
      } else if (addedNewLine) {
        toastPurchaseOrderLineAdded(
          params.supplierName,
          params.ingredientName,
          params.quantity,
          params.unitLabel,
        );
      } else if (existing) {
        toastPurchaseOrderQuantityIncreased(
          params.ingredientName,
          existing.quantity,
          params.unitLabel,
        );
      }
      return true;
    },
    [orders, persist],
  );

  const closeOrder = useCallback(
    async (orderId: string): Promise<boolean> => {
      const target = orders.find((o) => o.id === orderId);
      if (!target || target.status !== "open") {
        toast.error("Bestellung nicht gefunden oder bereits abgeschlossen.");
        return false;
      }
      const next = orders.map((o) =>
        o.id === orderId ? { ...o, status: "closed" as const } : o,
      );
      if (!(await persist(next))) return false;
      toast.success("Bestellung abgeschlossen");
      return true;
    },
    [orders, persist],
  );

  const reopenOrder = useCallback(
    async (orderId: string): Promise<boolean> => {
      const target = orders.find((o) => o.id === orderId);
      if (!target || target.status !== "closed") {
        toast.error("Bestellung nicht gefunden oder nicht abgeschlossen.");
        return false;
      }
      const hasOpenForSupplier = orders.some(
        (o) => o.supplierId === target.supplierId && o.status === "open",
      );
      if (hasOpenForSupplier) {
        toast.error(
          `Für „${target.supplierName}“ gibt es bereits eine offene Bestellung. Schließe diese zuerst oder nutze sie weiter.`,
        );
        return false;
      }
      const next = orders.map((o) =>
        o.id === orderId ? { ...o, status: "open" as const } : o,
      );
      if (!(await persist(next))) return false;
      toast.success("Bestellung wieder geöffnet");
      return true;
    },
    [orders, persist],
  );

  const setOrderDeliveryDate = useCallback(
    async (orderId: string, ymd: string | null): Promise<boolean> => {
      const target = orders.find((o) => o.id === orderId);
      if (!target) {
        toast.error("Bestellung nicht gefunden.");
        return false;
      }
      if (target.status !== "open") {
        toast.error("Lieferdatum kann nur bei offenen Bestellungen geändert werden.");
        return false;
      }
      const normalized =
        ymd && /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : null;
      if (target.deliveryDate === normalized) return true;
      const next = orders.map((o) =>
        o.id === orderId ? { ...o, deliveryDate: normalized } : o,
      );
      if (!(await persist(next))) return false;
      toast.success(
        normalized ? "Lieferdatum gespeichert" : "Lieferdatum entfernt",
        { id: `order-delivery-${orderId}` },
      );
      return true;
    },
    [orders, persist],
  );

  const updateLineQuantity = useCallback(
    async (
      orderId: string,
      lineId: string,
      nextQty: number,
      actor: OrderProtocolActor,
    ): Promise<boolean> => {
      const order = orders.find((o) => o.id === orderId);
      if (!order || order.status !== "open") {
        toast.error("Menge kann nur bei offenen Bestellungen geändert werden.");
        return false;
      }
      if (!Number.isFinite(nextQty) || nextQty < 0) {
        toast.error("Bitte eine gültige Menge (≥ 0) eingeben.");
        return false;
      }
      const line = order.lines.find((l) => l.id === lineId);
      if (!line) {
        toast.error("Position nicht gefunden.");
        return false;
      }
      const oldQty = line.quantity;
      if (oldQty === nextQty) return true;

      const next: PurchaseOrder[] = structuredClone(orders);
      const o = next.find((x) => x.id === orderId);
      if (!o) return false;
      const l = o.lines.find((x) => x.id === lineId);
      if (!l) return false;

      const logEntry: PurchaseOrderLogQuantityChange = {
        id: createId(),
        at: new Date().toISOString(),
        ...protocolActorNameFields(actor),
        kind: "quantity_change",
        ingredientId: l.ingredientId,
        ingredientName: l.ingredientName,
        fromQuantity: oldQty,
        toQuantity: nextQty,
        unitId: l.unitId,
        unitLabel: l.unitLabel,
      };
      o.log.push(logEntry);

      if (nextQty === 0) {
        o.lines = o.lines.filter((x) => x.id !== lineId);
      } else {
        l.quantity = nextQty;
      }

      if (!(await persist(next))) return false;
      if (nextQty === 0) {
        toastPurchaseOrderLineRemoved(l.ingredientName);
      } else {
        toastPurchaseOrderQuantityChanged(
          l.ingredientName,
          nextQty,
          l.unitLabel,
        );
      }
      return true;
    },
    [orders, persist],
  );

  const markLineDelivered = useCallback(
    async (
      orderId: string,
      lineId: string,
      actor: OrderProtocolActor,
    ): Promise<boolean> => {
      const target = orders.find((o) => o.id === orderId);
      if (!target || target.status !== "closed") {
        toast.error("Liefermeldung nur bei abgeschlossenen Bestellungen möglich.");
        return false;
      }
      const line = target.lines.find((l) => l.id === lineId);
      if (!line) {
        toast.error("Position nicht gefunden.");
        return false;
      }
      if (line.deliveredAt) {
        toast.error("Bereits als geliefert markiert.");
        return false;
      }
      if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
        toast.error("Ungültige Bestellmenge.");
        return false;
      }
      const next: PurchaseOrder[] = structuredClone(orders);
      const o = next.find((x) => x.id === orderId);
      if (!o) return false;
      const l = o.lines.find((x) => x.id === lineId);
      if (!l) return false;
      l.deliveredAt = new Date().toISOString();
      const logEntry: PurchaseOrderLogMarkedDelivered = {
        id: createId(),
        at: new Date().toISOString(),
        ...protocolActorNameFields(actor),
        kind: "marked_delivered",
        ingredientId: l.ingredientId,
        ingredientName: l.ingredientName,
        quantity: l.quantity,
        unitId: l.unitId,
        unitLabel: l.unitLabel,
        lineId: l.id,
      };
      o.log.push(logEntry);
      return await persist(next);
    },
    [orders, persist],
  );

  const unmarkLineDelivered = useCallback(
    async (
      orderId: string,
      lineId: string,
      actor: OrderProtocolActor,
    ): Promise<boolean> => {
      const target = orders.find((o) => o.id === orderId);
      if (!target || target.status !== "closed") {
        toast.error("Nur bei abgeschlossenen Bestellungen möglich.");
        return false;
      }
      const line = target.lines.find((l) => l.id === lineId);
      if (!line) {
        toast.error("Position nicht gefunden.");
        return false;
      }
      if (!line.deliveredAt) {
        toast.error("Position ist nicht als geliefert markiert.");
        return false;
      }
      if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
        toast.error("Ungültige Bestellmenge.");
        return false;
      }
      const next: PurchaseOrder[] = structuredClone(orders);
      const o = next.find((x) => x.id === orderId);
      if (!o) return false;
      const l = o.lines.find((x) => x.id === lineId);
      if (!l) return false;
      delete l.deliveredAt;
      const logEntry: PurchaseOrderLogDeliveryReverted = {
        id: createId(),
        at: new Date().toISOString(),
        ...protocolActorNameFields(actor),
        kind: "delivery_reverted",
        ingredientId: l.ingredientId,
        ingredientName: l.ingredientName,
        quantity: l.quantity,
        unitId: l.unitId,
        unitLabel: l.unitLabel,
        lineId: l.id,
      };
      o.log.push(logEntry);
      return await persist(next);
    },
    [orders, persist],
  );

  const getOpenOrderForSupplier = useCallback(
    (supplierId: string) =>
      orders.find((o) => o.supplierId === supplierId && o.status === "open") ?? null,
    [orders],
  );

  const syncSupplierNamesFromTaxonomy = useCallback(
    async (
      suppliers: ReadonlyArray<Pick<InventoryTaxonomyDefinition, "id" | "name">>,
    ): Promise<boolean> => {
      const { orders: next, changed } = applyTaxonomySupplierNamesToOrders(
        orders,
        suppliers,
      );
      if (!changed) return true;
      return persist(next);
    },
    [orders, persist],
  );

  const healCreatorAttribution = useCallback(async (): Promise<boolean> => {
    const { orders: next, changed } = healPurchaseOrdersCreatorAttribution(orders);
    if (!changed) return true;
    return persist(next);
  }, [orders, persist]);

  return {
    orders,
    isHydrated,
    addLine,
    closeOrder,
    reopenOrder,
    getOpenOrderForSupplier,
    getOpenLineContext,
    setOrderDeliveryDate,
    updateLineQuantity,
    markLineDelivered,
    unmarkLineDelivered,
    syncSupplierNamesFromTaxonomy,
    healCreatorAttribution,
  };
}
