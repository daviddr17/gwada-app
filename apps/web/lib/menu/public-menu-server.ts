import "server-only";

import {
  DEFAULT_MENU_CURRENCY_CODE,
  normalizeMenuCurrencyCode,
} from "@/lib/constants/menu-currencies";
import { normalizeRestaurantSlugInput } from "@/lib/restaurant/restaurant-slug";
import { DEFAULT_ACCENT_HEX } from "@/lib/theme/constants";
import { normalizeHex } from "@/lib/theme/color-utils";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_RESTAURANT_TIMEZONE } from "@/lib/restaurant/restaurant-timezone";
import {
  isMenuItemPubliclyAvailable,
  normalizeMenuAvailabilityYmd,
} from "@/lib/menu/item-utils";
import type {
  MenuCategoryDefinition,
  MenuItem,
  MenuMainCategoryDefinition,
  MenuOptionChoice,
  MenuOptionGroup,
  MenuTaxonomyDefinition,
} from "@/lib/types/menu";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PublicEmbedMenu = {
  restaurantId: string;
  name: string;
  slug: string;
  accentHex: string;
  currencyCode: string;
  mainCategories: MenuMainCategoryDefinition[];
  categories: MenuCategoryDefinition[];
  items: MenuItem[];
  tagDefinitions: MenuTaxonomyDefinition[];
  /** Aktive Optionsgruppen (Beilagen/Extras) für Anzeige bzw. spätere Auswahl. */
  optionGroups: MenuOptionGroup[];
  /**
   * Wenn true: Gäste können Optionen wählen (Online-/Tischbestellung).
   * Sonst nur ausgeschrieben anzeigen — Auswahl braucht POS / Ordering-Flow.
   */
  guestOrderingEnabled: boolean;
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
  available_from: string | null;
  available_to: string | null;
  menu_item_tags: { tag_id: string }[] | null;
  menu_item_allergens: { allergen_id: string }[] | null;
};

type OptionGroupRow = {
  id: string;
  name: string;
  is_active: boolean;
  min_select: number;
  max_select: number | null;
  menu_option_choices:
    | {
        id: string;
        name: string;
        price_delta: number | string;
        is_active: boolean;
        sort_order: number;
      }[]
    | null;
};

type ItemOptionLinkRow = {
  menu_item_id: string;
  option_group_id: string;
  sort_order: number;
};

function rowToMenuItem(
  row: MenuItemRow,
  optionGroupIds: string[] = [],
): MenuItem {
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
    optionGroupIds,
    availableFrom: normalizeMenuAvailabilityYmd(row.available_from),
    availableTo: normalizeMenuAvailabilityYmd(row.available_to),
  };
}

function rowToPublicOptionGroup(row: OptionGroupRow): MenuOptionGroup | null {
  if (!row.is_active) return null;
  const choices = [...(row.menu_option_choices ?? [])]
    .filter((c) => c.is_active)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(
      (c): MenuOptionChoice => ({
        id: c.id,
        name: c.name,
        priceDelta: Number(c.price_delta),
        active: true,
      }),
    );
  if (!choices.length) return null;
  return {
    id: row.id,
    name: row.name,
    active: true,
    minSelect: row.min_select,
    maxSelect: row.max_select,
    choices,
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
    .select("id, name, slug, brand_accent_hex, is_published, timezone")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    return { data: null, error: "db_error", status: 500 };
  }
  if (!row?.id || !row.is_published) {
    return { data: null, error: "not_found", status: 404 };
  }

  const restaurantId = row.id as string;
  const restaurantTimeZone =
    (row.timezone as string | null | undefined)?.trim() ||
    DEFAULT_RESTAURANT_TIMEZONE;

  const [mainCategoriesRes, categoriesRes, itemsRes, tagsRes, allergensRes, settingsRes] =
    await Promise.all([
    admin
      .from("menu_main_categories")
      .select("id, name, is_active, sort_order")
      .eq("restaurant_id", restaurantId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    admin
      .from("menu_categories")
      .select("id, name, is_active, sort_order, main_category_id")
      .eq("restaurant_id", restaurantId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    admin
      .from("menu_items")
      .select(
        `
        id, name, description, price, image_url, is_active, list_number, category_id,
        available_from, available_to,
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
    mainCategoriesRes.error ||
    categoriesRes.error ||
    itemsRes.error ||
    tagsRes.error ||
    allergensRes.error ||
    settingsRes.error
  ) {
    return { data: null, error: "db_error", status: 500 };
  }

  const mainCategories: MenuMainCategoryDefinition[] = (
    mainCategoriesRes.data ?? []
  ).map((c) => ({
    id: c.id as string,
    name: c.name as string,
    active: c.is_active as boolean,
  }));

  const activeCategoryIds = new Set(
    (categoriesRes.data ?? []).map((c) => c.id as string),
  );

  const categories: MenuCategoryDefinition[] = (categoriesRes.data ?? []).map(
    (c) => ({
      id: c.id as string,
      name: c.name as string,
      active: c.is_active as boolean,
      mainCategoryId: c.main_category_id as string,
    }),
  );

  const itemRows = (
    (itemsRes.data as unknown as MenuItemRow[] | null) ?? []
  ).filter((item) => activeCategoryIds.has(item.category_id));

  const itemIds = itemRows.map((item) => item.id);

  /** Optionen separat: fehlende Migration darf die öffentliche Speisekarte nicht killen. */
  let optionGroups: MenuOptionGroup[] = [];
  const optionIdsByItemId = new Map<string, string[]>();

  if (itemIds.length > 0) {
    const [groupsRes, linksRes] = await Promise.all([
      admin
        .from("menu_option_groups")
        .select(
          `
          id, name, is_active, min_select, max_select, sort_order,
          menu_option_choices(id, name, price_delta, is_active, sort_order)
        `,
        )
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
      admin
        .from("menu_item_option_groups")
        .select("menu_item_id, option_group_id, sort_order")
        .in("menu_item_id", itemIds)
        .order("sort_order", { ascending: true }),
    ]);

    if (!groupsRes.error && groupsRes.data?.length) {
      optionGroups = (groupsRes.data as unknown as OptionGroupRow[])
        .map(rowToPublicOptionGroup)
        .filter((g): g is MenuOptionGroup => g !== null);
    }

    if (!linksRes.error && linksRes.data?.length) {
      const activeGroupIds = new Set(optionGroups.map((g) => g.id));
      const links = [...(linksRes.data as ItemOptionLinkRow[])].sort(
        (a, b) => a.sort_order - b.sort_order,
      );
      for (const link of links) {
        if (!activeGroupIds.has(link.option_group_id)) continue;
        const list = optionIdsByItemId.get(link.menu_item_id) ?? [];
        list.push(link.option_group_id);
        optionIdsByItemId.set(link.menu_item_id, list);
      }
    }
  }

  const items: MenuItem[] = itemRows
    .map((row) => rowToMenuItem(row, optionIdsByItemId.get(row.id) ?? []))
    .filter((item) =>
      isMenuItemPubliclyAvailable(item, new Date(), restaurantTimeZone),
    );

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
      mainCategories,
      categories,
      items,
      tagDefinitions,
      optionGroups,
      /** Online-Bestellung noch nicht aktiv — Auswahl nur in POS / später Ordering. */
      guestOrderingEnabled: false,
    },
    error: null,
  };
}
