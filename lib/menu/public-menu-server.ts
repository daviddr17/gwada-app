import "server-only";

import {
  DEFAULT_MENU_CURRENCY_CODE,
  normalizeMenuCurrencyCode,
} from "@/lib/constants/menu-currencies";
import { normalizeRestaurantSlugInput } from "@/lib/restaurant/restaurant-slug";
import { DEFAULT_ACCENT_HEX } from "@/lib/theme/constants";
import { normalizeHex } from "@/lib/theme/color-utils";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  MenuCategoryDefinition,
  MenuItem,
  MenuTaxonomyDefinition,
} from "@/lib/types/menu";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PublicEmbedMenu = {
  restaurantId: string;
  name: string;
  slug: string;
  accentHex: string;
  currencyCode: string;
  categories: MenuCategoryDefinition[];
  items: MenuItem[];
  tagDefinitions: MenuTaxonomyDefinition[];
};

function adminOrError(): SupabaseClient | { error: string; status: number } {
  const admin = createSupabaseAdminClient();
  if (!admin) return { error: "server_misconfigured", status: 503 };
  return admin;
}

type MenuItemRow = {
  id: string;
  name: string;
  description: string | null;
  price: number | string;
  image_url: string | null;
  is_active: boolean;
  list_number: number | null;
  category_id: string;
  menu_item_tags: { tag_id: string }[] | null;
  menu_item_allergens: { allergen_id: string }[] | null;
};

function rowToMenuItem(row: MenuItemRow): MenuItem {
  const tagIds = (row.menu_item_tags ?? []).map((x) => x.tag_id);
  const allergenIds = (row.menu_item_allergens ?? []).map((x) => x.allergen_id);
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    price: Number(row.price),
    category: row.category_id,
    imageUrl: row.image_url ?? "",
    tags: [...tagIds, ...allergenIds],
    active: row.is_active,
    listNumber: row.list_number,
    recipe: null,
  };
}

export async function fetchPublicEmbedMenu(
  slugInput: string,
): Promise<
  | { data: PublicEmbedMenu; error: null }
  | { data: null; error: string; status: number }
> {
  const admin = adminOrError();
  if ("error" in admin) {
    return { data: null, error: admin.error, status: admin.status };
  }

  const slug = normalizeRestaurantSlugInput(slugInput);
  if (!slug) {
    return { data: null, error: "invalid_slug", status: 400 };
  }

  const { data: row, error } = await admin
    .from("restaurants")
    .select("id, name, slug, brand_accent_hex, is_published")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    return { data: null, error: "db_error", status: 500 };
  }
  if (!row?.id || !row.is_published) {
    return { data: null, error: "not_found", status: 404 };
  }

  const restaurantId = row.id as string;

  const [categoriesRes, itemsRes, tagsRes, allergensRes, settingsRes] =
    await Promise.all([
    admin
      .from("menu_categories")
      .select("id, name, is_active, sort_order")
      .eq("restaurant_id", restaurantId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    admin
      .from("menu_items")
      .select(
        `
        id, name, description, price, image_url, is_active, list_number, category_id,
        menu_item_tags(tag_id),
        menu_item_allergens(allergen_id)
      `,
      )
      .eq("restaurant_id", restaurantId)
      .eq("is_active", true)
      .order("category_id", { ascending: true })
      .order("list_number", { ascending: true }),
    admin
      .from("menu_tags")
      .select("id, name, is_active, background_color, sort_order")
      .eq("restaurant_id", restaurantId)
      .order("sort_order", { ascending: true }),
    admin
      .from("menu_allergens")
      .select("id, name, is_active, background_color, sort_order")
      .eq("restaurant_id", restaurantId)
      .order("sort_order", { ascending: true }),
    admin
      .from("restaurant_menu_settings")
      .select("currency_code")
      .eq("restaurant_id", restaurantId)
      .maybeSingle(),
  ]);

  if (
    categoriesRes.error ||
    itemsRes.error ||
    tagsRes.error ||
    allergensRes.error ||
    settingsRes.error
  ) {
    return { data: null, error: "db_error", status: 500 };
  }

  const activeCategoryIds = new Set(
    (categoriesRes.data ?? []).map((c) => c.id as string),
  );

  const categories: MenuCategoryDefinition[] = (categoriesRes.data ?? []).map(
    (c) => ({
      id: c.id as string,
      name: c.name as string,
      active: c.is_active as boolean,
    }),
  );

  const items: MenuItem[] = (itemsRes.data as unknown as MenuItemRow[] | null ?? [])
    .filter((item) => activeCategoryIds.has(item.category_id))
    .map(rowToMenuItem);

  const tagDefinitions: MenuTaxonomyDefinition[] = [
    ...(tagsRes.data ?? []).map((t) => ({
      id: t.id as string,
      name: t.name as string,
      active: t.is_active as boolean,
      backgroundColor: (t.background_color as string) || "#64748b",
    })),
    ...(allergensRes.data ?? []).map((a) => ({
      id: a.id as string,
      name: a.name as string,
      active: a.is_active as boolean,
      backgroundColor: (a.background_color as string) || "#64748b",
    })),
  ];

  const accentHex =
    normalizeHex(String(row.brand_accent_hex ?? "")) ?? DEFAULT_ACCENT_HEX;
  const currencyCode = normalizeMenuCurrencyCode(
    (settingsRes.data?.currency_code as string | undefined) ??
      DEFAULT_MENU_CURRENCY_CODE,
  );

  return {
    data: {
      restaurantId,
      name: String(row.name ?? ""),
      slug: String(row.slug ?? slug),
      accentHex,
      currencyCode,
      categories,
      items,
      tagDefinitions,
    },
    error: null,
  };
}
