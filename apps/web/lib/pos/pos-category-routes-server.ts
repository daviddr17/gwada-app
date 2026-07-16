import "server-only";

import {
  DEFAULT_POS_ROUTE_DESTINATION,
  routeIncludesKds,
  type PosRouteDestination,
} from "@gwada/pos-domain";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PosCategoryRoute = {
  id: string;
  menuCategoryId: string;
  destination: PosRouteDestination;
  kdsDeviceIds: string[];
  printerIds: string[];
};

function mapRoute(row: Record<string, unknown>): PosCategoryRoute {
  return {
    id: row.id as string,
    menuCategoryId: row.menu_category_id as string,
    destination:
      (row.destination as PosRouteDestination) ?? DEFAULT_POS_ROUTE_DESTINATION,
    kdsDeviceIds: (row.kds_device_ids as string[] | null) ?? [],
    printerIds: (row.printer_ids as string[] | null) ?? [],
  };
}

export async function listPosCategoryRoutes(
  supabase: SupabaseClient,
  restaurantId: string,
): Promise<PosCategoryRoute[]> {
  const { data, error } = await supabase
    .from("pos_category_routes")
    .select("id, menu_category_id, destination, kds_device_ids, printer_ids")
    .eq("restaurant_id", restaurantId);

  if (error) {
    console.warn("[pos] category routes", error.message);
    return [];
  }
  return (data ?? []).map((r) => mapRoute(r as Record<string, unknown>));
}

export async function upsertPosCategoryRoute(params: {
  supabase: SupabaseClient;
  restaurantId: string;
  menuCategoryId: string;
  destination: PosRouteDestination;
  kdsDeviceIds?: string[];
  printerIds?: string[];
}): Promise<PosCategoryRoute | null> {
  const payload = {
    restaurant_id: params.restaurantId,
    menu_category_id: params.menuCategoryId,
    destination: params.destination,
    kds_device_ids: params.kdsDeviceIds ?? [],
    printer_ids: params.printerIds ?? [],
  };

  const { data, error } = await params.supabase
    .from("pos_category_routes")
    .upsert(payload, { onConflict: "restaurant_id,menu_category_id" })
    .select("id, menu_category_id, destination, kds_device_ids, printer_ids")
    .maybeSingle();

  if (error) {
    console.warn("[pos] upsert category route", error.message);
    return null;
  }
  return data ? mapRoute(data as Record<string, unknown>) : null;
}

/** Route für Kategorie; ohne Zeile → Default KDS. */
export function resolveCategoryRoute(
  routes: PosCategoryRoute[],
  menuCategoryId: string | null | undefined,
): Pick<PosCategoryRoute, "destination" | "kdsDeviceIds" | "printerIds"> {
  if (!menuCategoryId) {
    return {
      destination: DEFAULT_POS_ROUTE_DESTINATION,
      kdsDeviceIds: [],
      printerIds: [],
    };
  }
  const found = routes.find((r) => r.menuCategoryId === menuCategoryId);
  if (!found) {
    return {
      destination: DEFAULT_POS_ROUTE_DESTINATION,
      kdsDeviceIds: [],
      printerIds: [],
    };
  }
  return {
    destination: found.destination,
    kdsDeviceIds: found.kdsDeviceIds,
    printerIds: found.printerIds,
  };
}

export function categoryAllowsKds(
  routes: PosCategoryRoute[],
  menuCategoryId: string | null | undefined,
): boolean {
  return routeIncludesKds(resolveCategoryRoute(routes, menuCategoryId).destination);
}
