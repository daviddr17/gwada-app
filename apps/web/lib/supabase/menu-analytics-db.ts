import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { MenuStatsPeriod } from "@/lib/menu/compute-menu-statistics";
import { startOfLocalDay } from "@/lib/reservations/month-range";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export type MenuItemAnalyticsRow = {
  id: string;
  category_id: string;
  price: number;
  is_active: boolean;
  has_image: boolean;
  tag_count: number;
  allergen_count: number;
  recipe_line_count: number;
  created_at: string;
};

export type MenuStatisticsBundle = {
  items: MenuItemAnalyticsRow[];
  categoryNames: Map<string, string>;
  periodStart: Date;
  periodEnd: Date;
};

const ITEM_SELECT = `
  id,
  category_id,
  price,
  is_active,
  image_url,
  created_at,
  menu_item_tags ( tag_id ),
  menu_item_allergens ( allergen_id ),
  menu_item_recipe_lines ( ingredient_id )
`;

function periodRange(monthsBack: MenuStatsPeriod): {
  periodStart: Date;
  periodEnd: Date;
} {
  const periodEnd = startOfLocalDay(new Date());
  periodEnd.setHours(23, 59, 59, 999);
  const periodStart = startOfLocalDay(new Date());
  periodStart.setMonth(periodStart.getMonth() - monthsBack);
  return { periodStart, periodEnd };
}

function mapItemRow(raw: Record<string, unknown>): MenuItemAnalyticsRow {
  const tags = raw.menu_item_tags as unknown[] | null;
  const allergens = raw.menu_item_allergens as unknown[] | null;
  const recipe = raw.menu_item_recipe_lines as unknown[] | null;
  const imageUrl = (raw.image_url as string) ?? "";
  return {
    id: raw.id as string,
    category_id: raw.category_id as string,
    price: Number(raw.price ?? 0),
    is_active: raw.is_active !== false,
    has_image: imageUrl.trim().length > 0,
    tag_count: tags?.length ?? 0,
    allergen_count: allergens?.length ?? 0,
    recipe_line_count: recipe?.length ?? 0,
    created_at: raw.created_at as string,
  };
}

export async function fetchMenuStatisticsBundle(params: {
  restaurantId: string;
  monthsBack?: MenuStatsPeriod;
}): Promise<{ data: MenuStatisticsBundle | null; error: string | null }> {
  if (!isUuidRestaurantId(params.restaurantId)) {
    return { data: null, error: null };
  }

  const months = params.monthsBack ?? 12;
  const { periodStart, periodEnd } = periodRange(months);
  const sb = createSupabaseBrowserClient();

  const [itemsRes, categoriesRes] = await Promise.all([
    sb
      .from("menu_items")
      .select(ITEM_SELECT)
      .eq("restaurant_id", params.restaurantId)
      .order("created_at", { ascending: true }),
    sb
      .from("menu_categories")
      .select("id, name, is_active")
      .eq("restaurant_id", params.restaurantId),
  ]);

  const error = itemsRes.error?.message ?? categoriesRes.error?.message ?? null;
  if (error) {
    return { data: null, error };
  }

  const categoryNames = new Map<string, string>();
  for (const row of categoriesRes.data ?? []) {
    const raw = row as Record<string, unknown>;
    if (raw.is_active === false) continue;
    categoryNames.set(raw.id as string, raw.name as string);
  }

  return {
    data: {
      items: (itemsRes.data ?? []).map((raw) =>
        mapItemRow(raw as Record<string, unknown>),
      ),
      categoryNames,
      periodStart,
      periodEnd,
    },
    error: null,
  };
}
