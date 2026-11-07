import "server-only";

import {
  isCategoryAvailableForChannel,
  isMenuItemAvailableForChannel,
  isMenuItemSoldOut,
  type GuestMenuChannel,
} from "@/lib/menu/item-utils";
import { fetchPublicEmbedMenu } from "@/lib/menu/public-menu-server";
import { menuItemIdsInsufficientStock } from "@/lib/ordering/guest-live-stock-server";
import type {
  PublicOrderingRecipeIngredient,
  SoldOutGuestDisplay,
} from "@/lib/ordering/online-ordering-types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type { PublicOrderingRecipeIngredient };

export type FetchPublicOrderingMenuOptions = {
  channel?: GuestMenuChannel;
  soldOutGuestDisplay?: SoldOutGuestDisplay;
  guestLiveStockCheckEnabled?: boolean;
};

/**
 * Public menu plus recipe ingredients for guest „ohne“ selection.
 * Ingredient ids are plain text (inventory_ingredients) — no PostgREST FK embed.
 */
export async function fetchPublicOrderingMenu(
  slug: string,
  options: FetchPublicOrderingMenuOptions = {},
) {
  const menuResult = await fetchPublicEmbedMenu(slug);
  if (!menuResult.data) return menuResult;

  const channel = options.channel;
  const soldOutDisplay = options.soldOutGuestDisplay ?? "hide";
  const liveStock = options.guestLiveStockCheckEnabled === true;

  let categories = menuResult.data.categories;
  let items = menuResult.data.items;

  if (channel) {
    categories = categories.filter((c) =>
      isCategoryAvailableForChannel(c, channel),
    );
    const categoryIds = new Set(categories.map((c) => c.id));
    items = items.filter(
      (item) =>
        categoryIds.has(item.category) &&
        isMenuItemAvailableForChannel(item, channel),
    );
  }

  if (liveStock) {
    const admin = createSupabaseAdminClient();
    if (admin) {
      const insufficient = await menuItemIdsInsufficientStock({
        supabase: admin,
        restaurantId: menuResult.data.restaurantId,
        menuItemIds: items.map((i) => i.id),
      });
      if (insufficient.size) {
        items = items.map((item) =>
          insufficient.has(item.id) ? { ...item, soldOut: true } : item,
        );
      }
    }
  }

  if (soldOutDisplay === "hide") {
    items = items.filter((item) => !isMenuItemSoldOut(item));
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return {
      data: {
        ...menuResult.data,
        categories,
        items,
        recipeByItemId: {} as Record<string, PublicOrderingRecipeIngredient[]>,
      },
      error: null,
    };
  }

  const itemIds = items.map((i) => i.id);
  if (!itemIds.length) {
    return {
      data: {
        ...menuResult.data,
        categories,
        items,
        recipeByItemId: {} as Record<string, PublicOrderingRecipeIngredient[]>,
      },
      error: null,
    };
  }

  const [{ data: lines }, { data: ingredientRows }] = await Promise.all([
    admin
      .from("menu_item_recipe_lines")
      .select("menu_item_id, ingredient_id, amount, sort_order")
      .in("menu_item_id", itemIds)
      .order("sort_order", { ascending: true }),
    admin
      .from("inventory_ingredients")
      .select("id, name")
      .eq("restaurant_id", menuResult.data.restaurantId)
      .eq("is_active", true),
  ]);

  const ingredientNameById = new Map(
    (ingredientRows ?? []).map((r) => [
      r.id as string,
      String(r.name ?? "").trim(),
    ]),
  );

  const recipeByItemId: Record<string, PublicOrderingRecipeIngredient[]> = {};
  for (const row of lines ?? []) {
    const itemId = row.menu_item_id as string;
    const ingredientId = String(row.ingredient_id ?? "");
    const name = ingredientNameById.get(ingredientId);
    if (!itemId || !ingredientId || !name) continue;
    const list = recipeByItemId[itemId] ?? [];
    list.push({ ingredientId, name });
    recipeByItemId[itemId] = list;
  }

  return {
    data: {
      ...menuResult.data,
      categories,
      items,
      recipeByItemId,
    },
    error: null,
  };
}
