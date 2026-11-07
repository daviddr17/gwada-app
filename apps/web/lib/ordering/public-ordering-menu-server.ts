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

/** Public menu plus recipe ingredients for guest „ohne“ selection. */
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

  const { data: lines } = await admin
    .from("menu_item_recipe_lines")
    .select("menu_item_id, ingredient_id, amount, sort_order, ingredients(id, name)")
    .in("menu_item_id", itemIds);

  const recipeByItemId: Record<string, PublicOrderingRecipeIngredient[]> = {};
  for (const row of lines ?? []) {
    const itemId = row.menu_item_id as string;
    const ing = row.ingredients as
      | { id: string; name: string }
      | { id: string; name: string }[]
      | null;
    const ingredient = Array.isArray(ing) ? ing[0] : ing;
    if (!ingredient?.id || !ingredient.name) continue;
    const list = recipeByItemId[itemId] ?? [];
    list.push({
      ingredientId: ingredient.id,
      name: ingredient.name,
    });
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
