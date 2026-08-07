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
  allPurchaseOrderLinesResolved,
  lineDeliveryStockQuantity,
} from "@/lib/inventory/purchase-order-line-delivery";
import {
  isPurchaseOrderStatus,
  previousPurchaseOrderStatus,
  purchaseOrderStatusLabel,
} from "@/lib/inventory/purchase-order-status";
import {
  healPurchaseOrdersCreatorAttribution,
  protocolActorNameFields,
  protocolCreatedByLabel,
  type OrderProtocolActor,
  type PurchaseOrder,
  type PurchaseOrderLine,
  type PurchaseOrderLineDeliveryStatus,
  type PurchaseOrderLogAdd,
  type PurchaseOrderLogDeliveryReverted,
  type PurchaseOrderLogEntry,
  type PurchaseOrderLogLegacy,
  type PurchaseOrderLogMarkedDelivered,
  type PurchaseOrderLogQuantityChange,
  type PurchaseOrderLogStatusChange,
  type PurchaseOrderStatus,
  type PurchaseOrdersPersistenceV1,
} from "@/lib/types/purchase-order";

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

function appendStatusChangeLog(
  order: PurchaseOrder,
  fromStatus: PurchaseOrderStatus,
  toStatus: PurchaseOrderStatus,
  actor: OrderProtocolActor,
) {
  const logEntry: PurchaseOrderLogStatusChange = {
    id: createId(),
    at: new Date().toISOString(),
    ...protocolActorNameFields(actor),
    kind: "status_change",
    fromStatus,
    toStatus,
    ingredientId: "",
    ingredientName: "",
    unitId: "",
    unitLabel: "",
  };
  order.log.push(logEntry);
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
      raw.quantity < 0
    )
      return null;
    const userSource =
      raw.userSource === "local_profile" ? ("local_profile" as const) : undefined;
    const deliveryStatus =
      raw.deliveryStatus === "delivered" ||
      raw.deliveryStatus === "not_delivered" ||
      raw.deliveryStatus === "partial"
        ? (raw.deliveryStatus as PurchaseOrderLineDeliveryStatus)
        : undefined;
    const note =
      typeof raw.note === "string" && raw.note.trim() !== ""
        ? raw.note.trim()
        : undefined;
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
      ...(deliveryStatus ? { deliveryStatus } : {}),
      ...(note ? { note } : {}),
    } satisfies PurchaseOrderLogMarkedDelivered;
  }

  if (raw.kind === "delivery_reverted") {
    if (typeof raw.lineId !== "string") return null;
    if (
      typeof raw.quantity !== "number" ||
      Number.isNaN(raw.quantity) ||
      raw.quantity < 0
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

  if (raw.kind === "status_change") {
    if (
      !isPurchaseOrderStatus(String(raw.fromStatus)) ||
      !isPurchaseOrderStatus(String(raw.toStatus))
    ) {
      return null;
    }
    const userSource =
      raw.userSource === "local_profile" ? ("local_profile" as const) : undefined;
    return {
      id: raw.id,
      at: raw.at,
      userFirstName,
      userLastName,
      ...(userSource ? { userSource } : {}),
      kind: "status_change",
      fromStatus: raw.fromStatus as PurchaseOrderStatus,
      toStatus: raw.toStatus as PurchaseOrderStatus,
      ingredientId: typeof raw.ingredientId === "string" ? raw.ingredientId : "",
      ingredientName:
        typeof raw.ingredientName === "string" ? raw.ingredientName : "",
      unitId: typeof raw.unitId === "string" ? raw.unitId : "",
      unitLabel: typeof raw.unitLabel === "string" ? raw.unitLabel : "",
    } satisfies PurchaseOrderLogStatusChange;
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
  const deliveryStatus =
    raw.deliveryStatus === "delivered" ||
    raw.deliveryStatus === "not_delivered" ||
    raw.deliveryStatus === "partial"
      ? (raw.deliveryStatus as PurchaseOrderLineDeliveryStatus)
      : undefined;
  let deliveredQuantity: number | undefined;
  if (
    typeof raw.deliveredQuantity === "number" &&
    Number.isFinite(raw.deliveredQuantity)
  ) {
    deliveredQuantity = raw.deliveredQuantity;
  }
  const deliveryNote =
    typeof raw.deliveryNote === "string" && raw.deliveryNote.trim() !== ""
      ? raw.deliveryNote.trim()
      : undefined;
  return {
    id: raw.id,
    ingredientId: raw.ingredientId,
    ingredientName: raw.ingredientName,
    ...(brandLabel !== undefined ? { brandLabel } : {}),
    quantity: raw.quantity,
    unitId: raw.unitId,
    unitLabel: raw.unitLabel,
    ...(deliveredAt !== undefined ? { deliveredAt } : {}),
    ...(deliveryStatus ? { deliveryStatus } : {}),
    ...(deliveredQuantity !== undefined ? { deliveredQuantity } : {}),
    ...(deliveryNote ? { deliveryNote } : {}),
  };
}

function parseOrder(raw: unknown): PurchaseOrder | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.id !== "string") return null;
  if (typeof raw.supplierId !== "string" || typeof raw.supplierName !== "string")
    return null;
  if (!isPurchaseOrderStatus(String(raw.status))) return null;
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
    status: raw.status as PurchaseOrderStatus,
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

export function usePurchaseOrdersStorage(options?: { enabled?: boolean }) {
  const queryClient = useQueryClient();
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const supabaseOnly = isSupabaseOnlyMode();
  const failSave = supabaseOnly ? toastDatabaseUnavailable : toastStorageError;
  const useDbInventory = inventoryRelationalPersistenceEnabled();
  const queryEnabled = options?.enabled !== false;

  const [localOrders, setLocalOrders] = useState<PurchaseOrder[]>([]);
  const [isLocalHydrated, setIsLocalHydrated] = useState(!useDbInventory);

  const ordersQuery = useQuery({
    queryKey: queryKeys.inventory.purchaseOrders(restaurantId ?? ""),
    queryFn: fetchPurchaseOrdersForRestaurant,
    enabled:
      queryEnabled &&
      useDbInventory &&
      workspaceReady &&
      Boolean(restaurantId),
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

  /** Sofort in UI/Cache schreiben (vor await Persist) — bei Fehler zurückrollen. */
  const applyOrdersOptimistic = useCallback(
    (next: PurchaseOrder[]) => {
      if (useDbInventory) {
        if (restaurantId) {
          queryClient.setQueryData(
            queryKeys.inventory.purchaseOrders(restaurantId),
            next,
          );
        }
        mirrorWorkspaceJsonLocal(PURCHASE_ORDERS_STORAGE_KEY, {
          version: 1 as const,
          orders: next,
        });
        return;
      }
      setLocalOrders(next);
      mirrorWorkspaceJsonLocal(PURCHASE_ORDERS_STORAGE_KEY, {
        version: 1 as const,
        orders: next,
      });
    },
    [queryClient, restaurantId, useDbInventory],
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

  /** Offen → Bestellt */
  const markOrderOrdered = useCallback(
    async (orderId: string, actor: OrderProtocolActor): Promise<boolean> => {
      const target = orders.find((o) => o.id === orderId);
      if (!target || target.status !== "open") {
        toast.error("Bestellung nicht gefunden oder nicht offen.");
        return false;
      }
      if (target.lines.length === 0) {
        toast.error("Bestellung hat keine Positionen.");
        return false;
      }
      const next: PurchaseOrder[] = structuredClone(orders);
      const o = next.find((x) => x.id === orderId);
      if (!o) return false;
      o.status = "ordered";
      appendStatusChangeLog(o, "open", "ordered", actor);
      if (!(await persist(next))) return false;
      toast.success("Als bestellt markiert");
      return true;
    },
    [orders, persist],
  );

  /**
   * Bestellt → Abgeschlossen.
   * Ohne `force` nur wenn alle Positionen eine Liefer-Antwort haben.
   */
  const closeOrder = useCallback(
    async (
      orderId: string,
      actor: OrderProtocolActor,
      options?: { force?: boolean; silent?: boolean },
    ): Promise<boolean> => {
      const target = orders.find((o) => o.id === orderId);
      if (!target || target.status !== "ordered") {
        toast.error("Bestellung nicht gefunden oder nicht im Status Bestellt.");
        return false;
      }
      const force = options?.force === true;
      if (!force && !allPurchaseOrderLinesResolved(target.lines)) {
        toast.error("Noch nicht alle Positionen bearbeitet.");
        return false;
      }
      const next: PurchaseOrder[] = structuredClone(orders);
      const o = next.find((x) => x.id === orderId);
      if (!o) return false;
      o.status = "closed";
      appendStatusChangeLog(o, "ordered", "closed", actor);
      if (!(await persist(next))) return false;
      if (!options?.silent) {
        toast.success("Bestellung abgeschlossen");
      }
      return true;
    },
    [orders, persist],
  );

  /** Immer einen Status zurück: Abgeschlossen → Bestellt → Offen */
  const reopenOrder = useCallback(
    async (orderId: string, actor: OrderProtocolActor): Promise<boolean> => {
      const target = orders.find((o) => o.id === orderId);
      if (!target) {
        toast.error("Bestellung nicht gefunden.");
        return false;
      }
      const prev = previousPurchaseOrderStatus(target.status);
      if (!prev) {
        toast.error("Bestellung ist bereits offen.");
        return false;
      }
      if (prev === "open") {
        const hasOpenForSupplier = orders.some(
          (o) =>
            o.id !== target.id &&
            o.supplierId === target.supplierId &&
            o.status === "open",
        );
        if (hasOpenForSupplier) {
          toast.error(
            `Für „${target.supplierName}“ gibt es bereits eine offene Bestellung. Schließe diese zuerst oder nutze sie weiter.`,
          );
          return false;
        }
      }
      const next: PurchaseOrder[] = structuredClone(orders);
      const o = next.find((x) => x.id === orderId);
      if (!o) return false;
      const from = o.status;
      o.status = prev;
      appendStatusChangeLog(o, from, prev, actor);
      if (!(await persist(next))) return false;
      toast.success(`Zurück auf „${purchaseOrderStatusLabel(prev)}“`);
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
      const normalized =
        ymd && /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : null;
      if (target.deliveryDate === normalized) return true;
      const previous = orders;
      const next = orders.map((o) =>
        o.id === orderId ? { ...o, deliveryDate: normalized } : o,
      );
      applyOrdersOptimistic(next);
      if (!(await persist(next))) {
        applyOrdersOptimistic(previous);
        return false;
      }
      toast.success(
        normalized ? "Lieferdatum gespeichert" : "Lieferdatum entfernt",
        { id: `order-delivery-${orderId}` },
      );
      return true;
    },
    [applyOrdersOptimistic, orders, persist],
  );

  const updateLineQuantity = useCallback(
    async (
      orderId: string,
      lineId: string,
      nextQty: number,
      actor: OrderProtocolActor,
    ): Promise<boolean> => {
      const order = orders.find((o) => o.id === orderId);
      if (!order) {
        toast.error("Bestellung nicht gefunden.");
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

  /**
   * Setzt Liefer-Antwort. Gibt `stockDelta` für Bestand und ggf. `autoClosed` zurück.
   * Persistiert die Bestellung; Bestand bleibt Aufgabe des Callers.
   */
  const setLineDelivery = useCallback(
    async (
      orderId: string,
      lineId: string,
      input: {
        status: PurchaseOrderLineDeliveryStatus;
        deliveredQuantity?: number;
        note?: string;
      },
      actor: OrderProtocolActor,
    ): Promise<
      | { ok: true; stockDelta: number; autoClosed: boolean }
      | { ok: false }
    > => {
      const target = orders.find((o) => o.id === orderId);
      if (!target || (target.status !== "ordered" && target.status !== "closed")) {
        toast.error("Liefer-Antwort nur bei bestellten oder abgeschlossenen Bestellungen.");
        return { ok: false };
      }
      const line = target.lines.find((l) => l.id === lineId);
      if (!line) {
        toast.error("Position nicht gefunden.");
        return { ok: false };
      }
      if (!Number.isFinite(line.quantity) || line.quantity < 0) {
        toast.error("Ungültige Bestellmenge.");
        return { ok: false };
      }

      let deliveredQuantity = 0;
      if (input.status === "delivered") {
        deliveredQuantity =
          typeof input.deliveredQuantity === "number" &&
          Number.isFinite(input.deliveredQuantity)
            ? input.deliveredQuantity
            : line.quantity;
      } else if (input.status === "partial") {
        if (
          typeof input.deliveredQuantity !== "number" ||
          !Number.isFinite(input.deliveredQuantity) ||
          input.deliveredQuantity < 0
        ) {
          toast.error("Bitte gelieferte Menge angeben.");
          return { ok: false };
        }
        deliveredQuantity = input.deliveredQuantity;
      }

      const note =
        input.status === "not_delivered" || input.status === "partial"
          ? input.note?.trim() || undefined
          : undefined;

      const prevStock = lineDeliveryStockQuantity(line);
      const nextLinePreview: PurchaseOrderLine = {
        ...line,
        deliveryStatus: input.status,
        deliveredQuantity,
        deliveredAt: new Date().toISOString(),
        ...(note ? { deliveryNote: note } : { deliveryNote: undefined }),
      };
      const nextStock = lineDeliveryStockQuantity(nextLinePreview);
      const stockDelta = nextStock - prevStock;

      const previous = orders;
      const next: PurchaseOrder[] = structuredClone(orders);
      const o = next.find((x) => x.id === orderId);
      if (!o) return { ok: false };
      const l = o.lines.find((x) => x.id === lineId);
      if (!l) return { ok: false };

      l.deliveryStatus = input.status;
      l.deliveredQuantity = deliveredQuantity;
      l.deliveredAt = new Date().toISOString();
      if (note) l.deliveryNote = note;
      else delete l.deliveryNote;

      const logEntry: PurchaseOrderLogMarkedDelivered = {
        id: createId(),
        at: new Date().toISOString(),
        ...protocolActorNameFields(actor),
        kind: "marked_delivered",
        ingredientId: l.ingredientId,
        ingredientName: l.ingredientName,
        quantity: nextStock,
        unitId: l.unitId,
        unitLabel: l.unitLabel,
        lineId: l.id,
        deliveryStatus: input.status,
        ...(note ? { note } : {}),
      };
      o.log.push(logEntry);

      let autoClosed = false;
      if (
        o.status === "ordered" &&
        allPurchaseOrderLinesResolved(o.lines)
      ) {
        o.status = "closed";
        appendStatusChangeLog(o, "ordered", "closed", actor);
        autoClosed = true;
      }

      applyOrdersOptimistic(next);
      if (!(await persist(next))) {
        applyOrdersOptimistic(previous);
        return { ok: false };
      }
      return { ok: true, stockDelta, autoClosed };
    },
    [applyOrdersOptimistic, orders, persist],
  );

  const clearLineDelivery = useCallback(
    async (
      orderId: string,
      lineId: string,
      actor: OrderProtocolActor,
    ): Promise<{ ok: true; stockDelta: number } | { ok: false }> => {
      const target = orders.find((o) => o.id === orderId);
      if (!target || (target.status !== "ordered" && target.status !== "closed")) {
        toast.error("Nur bei bestellten oder abgeschlossenen Bestellungen möglich.");
        return { ok: false };
      }
      const line = target.lines.find((l) => l.id === lineId);
      if (!line) {
        toast.error("Position nicht gefunden.");
        return { ok: false };
      }
      const prevStock = lineDeliveryStockQuantity(line);
      if (prevStock === 0 && !line.deliveryStatus && !line.deliveredAt) {
        toast.error("Position hat keine Liefer-Antwort.");
        return { ok: false };
      }

      const previous = orders;
      const next: PurchaseOrder[] = structuredClone(orders);
      const o = next.find((x) => x.id === orderId);
      if (!o) return { ok: false };
      const l = o.lines.find((x) => x.id === lineId);
      if (!l) return { ok: false };
      delete l.deliveredAt;
      delete l.deliveryStatus;
      delete l.deliveredQuantity;
      delete l.deliveryNote;

      const logEntry: PurchaseOrderLogDeliveryReverted = {
        id: createId(),
        at: new Date().toISOString(),
        ...protocolActorNameFields(actor),
        kind: "delivery_reverted",
        ingredientId: l.ingredientId,
        ingredientName: l.ingredientName,
        quantity: prevStock,
        unitId: l.unitId,
        unitLabel: l.unitLabel,
        lineId: l.id,
      };
      o.log.push(logEntry);

      applyOrdersOptimistic(next);
      if (!(await persist(next))) {
        applyOrdersOptimistic(previous);
        return { ok: false };
      }
      return { ok: true, stockDelta: -prevStock };
    },
    [applyOrdersOptimistic, orders, persist],
  );

  /** @deprecated Kompatibilität — nutzt setLineDelivery(delivered) */
  const markLineDelivered = useCallback(
    async (
      orderId: string,
      lineId: string,
      actor: OrderProtocolActor,
    ): Promise<boolean> => {
      const result = await setLineDelivery(
        orderId,
        lineId,
        { status: "delivered" },
        actor,
      );
      return result.ok;
    },
    [setLineDelivery],
  );

  /** @deprecated Kompatibilität — nutzt clearLineDelivery */
  const unmarkLineDelivered = useCallback(
    async (
      orderId: string,
      lineId: string,
      actor: OrderProtocolActor,
    ): Promise<boolean> => {
      const result = await clearLineDelivery(orderId, lineId, actor);
      return result.ok;
    },
    [clearLineDelivery],
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
    markOrderOrdered,
    closeOrder,
    reopenOrder,
    getOpenOrderForSupplier,
    getOpenLineContext,
    setOrderDeliveryDate,
    updateLineQuantity,
    setLineDelivery,
    clearLineDelivery,
    markLineDelivered,
    unmarkLineDelivered,
    syncSupplierNamesFromTaxonomy,
    healCreatorAttribution,
  };
}
