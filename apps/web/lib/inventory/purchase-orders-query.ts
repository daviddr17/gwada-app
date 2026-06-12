"use client";

import { PURCHASE_ORDERS_STORAGE_KEY } from "@/lib/constants/inventory-storage";
import { migratePurchaseOrdersFromLegacyAppStateIfEmpty } from "@/lib/supabase/app-state-relational-migration";
import { loadPurchaseOrdersRelational } from "@/lib/supabase/inventory-db";
import {
  getWorkspaceRestaurantId,
  loadWorkspaceJsonLocal,
  mirrorWorkspaceJsonLocal,
} from "@/lib/supabase/workspace-persistence";
import type { PurchaseOrder } from "@/lib/types/purchase-order";

function parseOrdersFromUnknown(parsed: unknown): PurchaseOrder[] {
  if (!parsed || typeof parsed !== "object") return [];
  const o = parsed as { orders?: unknown };
  if (!Array.isArray(o.orders)) return [];
  return o.orders as PurchaseOrder[];
}

export function peekPurchaseOrdersCache(): PurchaseOrder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PURCHASE_ORDERS_STORAGE_KEY);
    if (raw) return parseOrdersFromUnknown(JSON.parse(raw));
  } catch {
    /* ignore */
  }
  return parseOrdersFromUnknown(loadWorkspaceJsonLocal(PURCHASE_ORDERS_STORAGE_KEY));
}

export async function fetchPurchaseOrdersForRestaurant(): Promise<PurchaseOrder[]> {
  const rid = await getWorkspaceRestaurantId();
  if (rid) {
    await migratePurchaseOrdersFromLegacyAppStateIfEmpty(rid);
  }
  const rows = await loadPurchaseOrdersRelational(rid);
  const orders = rows ?? [];
  if (orders.length) {
    mirrorWorkspaceJsonLocal(PURCHASE_ORDERS_STORAGE_KEY, {
      version: 1 as const,
      orders,
    });
  }
  return orders;
}
