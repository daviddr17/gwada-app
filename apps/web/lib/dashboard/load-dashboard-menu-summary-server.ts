import "server-only";

import { computeDashboardMenuSummary } from "@/lib/menu/compute-dashboard-menu-summary";
import type { DashboardMenuSummary } from "@/lib/menu/compute-dashboard-menu-summary";
import type { MenuCategoryDefinition, MenuItem } from "@/lib/types/menu";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function loadDashboardMenuSummaryServer(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<DashboardMenuSummary> {
  const [{ data: itemRows }, { data: categoryRows }] = await Promise.all([
    sb
      .from("menu_items")
      .select("id, name, price, is_active, category_id")
      .eq("restaurant_id", restaurantId),
    sb
      .from("menu_categories")
      .select("id, name, is_active")
      .eq("restaurant_id", restaurantId)
      .order("sort_order", { ascending: true }),
  ]);

  const categories: MenuCategoryDefinition[] = (categoryRows ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    active: (r.is_active as boolean) !== false,
  }));

  const items: MenuItem[] = (itemRows ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    description: "",
    price: Number(r.price),
    category: r.category_id as string,
    imageUrl: "",
    tags: [],
    active: (r.is_active as boolean) !== false,
    listNumber: null,
    recipe: null,
  }));

  return computeDashboardMenuSummary(items, categories);
}
