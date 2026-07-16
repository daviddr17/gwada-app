import "server-only";

import {
  allocationAmountCents,
  openLineQuantity,
} from "@gwada/pos-domain";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadRegisterStatus } from "@/lib/pos/register-status-server";
import type { MenuOptionChoice, MenuOptionGroup } from "@/lib/types/menu";

export type PosBootstrapFloorArea = {
  id: string;
  name: string;
  display_number: number;
  color_hex: string;
  sort_order: number;
};

export type PosBootstrapFloorTable = {
  id: string;
  area_id: string;
  table_number: number;
  table_name: string | null;
  capacity: number;
  is_active: boolean;
};

export type PosBootstrapOpenSession = {
  id: string;
  dining_table_id: string;
  cover_count: number;
  opened_at: string;
};

export type PosBootstrapSessionMeta = {
  orderCount: number;
  openCents: number;
};

export type PosBootstrapRecipeIngredient = {
  ingredientId: string;
  name: string;
  amount: number;
};

export type PosBootstrapMenuItem = {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  vatRate: number;
  categoryId: string;
  listNumber: number | null;
  optionGroupIds: string[];
  /** Rezept-Zutaten für „Ohne …“-Mehrfachauswahl */
  recipe: PosBootstrapRecipeIngredient[];
  active: boolean;
};

export type PosBootstrapPayload = {
  restaurantId: string;
  restaurantName: string;
  generatedAt: string;
  register: Awaited<ReturnType<typeof loadRegisterStatus>>;
  floor: {
    areas: PosBootstrapFloorArea[];
    tables: PosBootstrapFloorTable[];
    openSessions: PosBootstrapOpenSession[];
    orderCountBySessionId: Record<string, number>;
    sessionMetaBySessionId: Record<string, PosBootstrapSessionMeta>;
  };
  menu: {
    categories: { id: string; name: string; sortOrder: number }[];
    items: PosBootstrapMenuItem[];
    optionGroups: MenuOptionGroup[];
  };
};

export async function loadPosBootstrap(
  supabase: SupabaseClient,
  restaurantId: string,
): Promise<PosBootstrapPayload | { error: string; status: number }> {
  const { data: restaurant, error: restaurantError } = await supabase
    .from("restaurants")
    .select("id, name")
    .eq("id", restaurantId)
    .maybeSingle();

  if (restaurantError || !restaurant) {
    return { error: "restaurant_not_found", status: 404 };
  }

  const [register, areasRes, tablesRes, sessionsRes, categoriesRes] =
    await Promise.all([
      loadRegisterStatus(restaurantId),
      supabase
        .from("dining_areas")
        .select("id, name, display_number, color_hex, sort_order")
        .eq("restaurant_id", restaurantId)
        .order("display_number", { ascending: true })
        .order("name", { ascending: true }),
      supabase
        .from("dining_tables")
        .select("id, area_id, table_number, table_name, capacity, is_active")
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)
        .order("table_number", { ascending: true }),
      supabase
        .from("pos_table_sessions")
        .select("id, dining_table_id, cover_count, opened_at")
        .eq("restaurant_id", restaurantId)
        .eq("status", "open"),
      supabase
        .from("menu_categories")
        .select("id, name, sort_order, is_active")
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
    ]);

  const itemsWithRelations = await supabase
    .from("menu_items")
    .select(
      `
      id, name, description, price, vat_rate, category_id, list_number, is_active,
      menu_item_option_groups(option_group_id, sort_order),
      menu_item_recipe_lines(ingredient_id, amount, sort_order)
    `,
    )
    .eq("restaurant_id", restaurantId)
    .eq("is_active", true)
    .order("list_number", { ascending: true });

  const itemsFallback = itemsWithRelations.error
    ? await supabase
        .from("menu_items")
        .select(
          "id, name, description, price, vat_rate, category_id, list_number, is_active",
        )
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)
        .order("list_number", { ascending: true })
    : null;

  const itemsRes = itemsFallback ?? itemsWithRelations;

  const { data: ingredientRows } = await supabase
    .from("inventory_ingredients")
    .select("id, name")
    .eq("restaurant_id", restaurantId)
    .eq("is_active", true);

  const ingredientNameById = new Map(
    (ingredientRows ?? []).map((r) => [r.id as string, String(r.name ?? "")]),
  );

  const groupsRes = await supabase
    .from("menu_option_groups")
    .select(
      `
      id, name, is_active, sort_order, min_select, max_select,
      menu_option_choices(id, name, price_delta, is_active, sort_order)
    `,
    )
    .eq("restaurant_id", restaurantId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (areasRes.error || tablesRes.error || sessionsRes.error) {
    console.warn(
      "[pos] bootstrap floor",
      areasRes.error?.message,
      tablesRes.error?.message,
      sessionsRes.error?.message,
    );
    return { error: "floor_load_failed", status: 500 };
  }

  const openSessions = (sessionsRes.data ?? []) as PosBootstrapOpenSession[];
  const sessionIds = openSessions.map((s) => s.id);
  const orderCountBySessionId: Record<string, number> = {};
  const sessionMetaBySessionId: Record<string, PosBootstrapSessionMeta> = {};
  for (const sid of sessionIds) {
    sessionMetaBySessionId[sid] = { orderCount: 0, openCents: 0 };
  }

  if (sessionIds.length > 0) {
    const { data: orders, error: ordersError } = await supabase
      .from("pos_orders")
      .select("id, table_session_id")
      .in("table_session_id", sessionIds)
      .neq("status", "cancelled");

    if (!ordersError && orders?.length) {
      const orderIds: string[] = [];
      const sessionIdByOrderId = new Map<string, string>();
      for (const row of orders) {
        const sid = row.table_session_id as string;
        const oid = row.id as string;
        orderIds.push(oid);
        sessionIdByOrderId.set(oid, sid);
        orderCountBySessionId[sid] = (orderCountBySessionId[sid] ?? 0) + 1;
        const meta = sessionMetaBySessionId[sid];
        if (meta) meta.orderCount += 1;
      }

      if (orderIds.length > 0) {
        const { data: lineRows } = await supabase
          .from("pos_order_lines")
          .select("order_id, quantity, paid_quantity, line_total_cents")
          .in("order_id", orderIds);

        for (const line of lineRows ?? []) {
          const sid = sessionIdByOrderId.get(line.order_id as string);
          if (!sid) continue;
          const meta = sessionMetaBySessionId[sid];
          if (!meta) continue;
          const openQty = openLineQuantity(
            Number(line.quantity),
            Number(line.paid_quantity ?? 0),
          );
          if (openQty <= 0) continue;
          meta.openCents += allocationAmountCents(
            Number(line.line_total_cents),
            Number(line.quantity),
            openQty,
          );
        }
      }
    }
  }

  type ItemRow = {
    id: string;
    name: string;
    description: string | null;
    price: number | string;
    vat_rate: number | string | null;
    category_id: string;
    list_number: number | null;
    is_active: boolean;
    menu_item_option_groups:
      | { option_group_id: string; sort_order: number }[]
      | null;
    menu_item_recipe_lines:
      | { ingredient_id: string; amount: number | string; sort_order?: number }[]
      | null;
  };

  const activeCategoryIds = new Set(
    (categoriesRes.data ?? []).map((c) => c.id as string),
  );

  const items: PosBootstrapMenuItem[] = (
    (itemsRes.error ? [] : ((itemsRes.data ?? []) as unknown as ItemRow[]))
  )
    .filter((row) => activeCategoryIds.has(row.category_id))
    .map((row) => {
      const links = [...(row.menu_item_option_groups ?? [])].sort(
        (a, b) => a.sort_order - b.sort_order,
      );
      const recipeLines = [...(row.menu_item_recipe_lines ?? [])].sort(
        (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
      );
      const recipe: PosBootstrapRecipeIngredient[] = recipeLines
        .map((l) => ({
          ingredientId: l.ingredient_id,
          name: ingredientNameById.get(l.ingredient_id) ?? l.ingredient_id,
          amount: Number(l.amount),
        }))
        .filter((l) => l.name.trim().length > 0);
      return {
        id: row.id,
        name: row.name,
        description: row.description ?? "",
        priceCents: Math.round(Number(row.price) * 100),
        vatRate: Number(row.vat_rate ?? 19),
        categoryId: row.category_id,
        listNumber: row.list_number,
        optionGroupIds: links.map((l) => l.option_group_id),
        recipe,
        active: row.is_active,
      };
    });

  type GroupRow = {
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

  const optionGroups: MenuOptionGroup[] = (
    groupsRes.error ? [] : ((groupsRes.data ?? []) as unknown as GroupRow[])
  )
    .filter((g) => g.is_active)
    .map((g) => {
      const choices = [...(g.menu_option_choices ?? [])]
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
      return {
        id: g.id,
        name: g.name,
        active: true,
        minSelect: g.min_select,
        maxSelect: g.max_select,
        choices,
      };
    })
    .filter((g) => g.choices.length > 0);

  return {
    restaurantId,
    restaurantName: String(restaurant.name ?? ""),
    generatedAt: new Date().toISOString(),
    register,
    floor: {
      areas: (areasRes.data ?? []) as PosBootstrapFloorArea[],
      tables: (tablesRes.data ?? []) as PosBootstrapFloorTable[],
      openSessions,
      orderCountBySessionId,
      sessionMetaBySessionId,
    },
    menu: {
      categories: (categoriesRes.data ?? []).map((c) => ({
        id: c.id as string,
        name: c.name as string,
        sortOrder: Number(c.sort_order ?? 0),
      })),
      items,
      optionGroups,
    },
  };
}
