import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type MenuItemSideConfig = {
  menuItemId: string;
  itemName: string;
  priceCents: number;
  sidePriceCents: number | null;
  required: boolean;
  maxSides: number;
  includedCount: number;
  hasConfig: boolean;
};

function eurosToCents(price: unknown): number {
  const n = typeof price === "number" ? price : Number(price);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

/** Items that can act as sides or have side groups — list mains with optional config + side articles. */
export async function listMenuSideConfigs(
  supabase: SupabaseClient,
  restaurantId: string,
): Promise<MenuItemSideConfig[]> {
  const { data: items, error } = await supabase
    .from("menu_items")
    .select("id, name, price, side_price_cents, is_active")
    .eq("restaurant_id", restaurantId)
    .eq("is_active", true)
    .order("name", { ascending: true });
  if (error || !items) return [];

  const ids = items.map((i) => i.id as string);
  const { data: configs } = await supabase
    .from("menu_item_side_config")
    .select("menu_item_id, required, max_sides, included_count")
    .eq("restaurant_id", restaurantId)
    .in("menu_item_id", ids);

  const cfgByItem = new Map(
    (configs ?? []).map((c) => [c.menu_item_id as string, c]),
  );

  return items.map((item) => {
    const id = item.id as string;
    const cfg = cfgByItem.get(id);
    return {
      menuItemId: id,
      itemName: item.name as string,
      priceCents: eurosToCents(item.price),
      sidePriceCents:
        item.side_price_cents == null ? null : Number(item.side_price_cents),
      required: Boolean(cfg?.required),
      maxSides: cfg ? Number(cfg.max_sides) : 1,
      includedCount: cfg ? Number(cfg.included_count) : 0,
      hasConfig: Boolean(cfg),
    };
  });
}

export async function upsertMenuItemSideConfig(params: {
  supabase: SupabaseClient;
  restaurantId: string;
  menuItemId: string;
  sidePriceCents: number | null;
  required: boolean;
  maxSides: number;
  includedCount: number;
  clearConfig?: boolean;
}): Promise<MenuItemSideConfig | null> {
  const {
    supabase,
    restaurantId,
    menuItemId,
    sidePriceCents,
    required,
    maxSides,
    includedCount,
    clearConfig,
  } = params;

  const { data: item, error: itemErr } = await supabase
    .from("menu_items")
    .update({ side_price_cents: sidePriceCents })
    .eq("id", menuItemId)
    .eq("restaurant_id", restaurantId)
    .select("id, name, price, side_price_cents")
    .maybeSingle();
  if (itemErr || !item) return null;

  if (clearConfig) {
    await supabase
      .from("menu_item_side_config")
      .delete()
      .eq("menu_item_id", menuItemId)
      .eq("restaurant_id", restaurantId);
    return {
      menuItemId,
      itemName: item.name as string,
      priceCents: eurosToCents(item.price),
      sidePriceCents:
        item.side_price_cents == null ? null : Number(item.side_price_cents),
      required: false,
      maxSides: 1,
      includedCount: 0,
      hasConfig: false,
    };
  }

  const max = Math.min(12, Math.max(0, Math.round(maxSides)));
  const included = Math.min(max, Math.max(0, Math.round(includedCount)));

  const { error: upsertErr } = await supabase.from("menu_item_side_config").upsert(
    {
      menu_item_id: menuItemId,
      restaurant_id: restaurantId,
      required,
      max_sides: max,
      included_count: included,
    },
    { onConflict: "menu_item_id" },
  );
  if (upsertErr) return null;

  return {
    menuItemId,
    itemName: item.name as string,
    priceCents: eurosToCents(item.price),
    sidePriceCents:
      item.side_price_cents == null ? null : Number(item.side_price_cents),
    required,
    maxSides: max,
    includedCount: included,
    hasConfig: true,
  };
}
