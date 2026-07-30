import { Controller, Get, Query, BadRequestException } from "@nestjs/common";
import { SupabaseAdminService } from "../supabase-admin.service";

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v,
  );
}

@Controller("v1/catalog")
export class CatalogController {
  constructor(private readonly supabaseAdmin: SupabaseAdminService) {}

  @Get()
  async getCatalog(@Query("restaurantId") restaurantId: string) {
    const rid = restaurantId?.trim() ?? "";
    if (!isUuid(rid)) throw new BadRequestException("restaurantId required");

    const sb = this.supabaseAdmin.getClient();

    const [
      { data: categories },
      { data: items },
      { data: groups },
      { data: choices },
      { data: links },
      { data: sideConfigs },
    ] = await Promise.all([
      sb
        .from("menu_categories")
        .select("id, name, sort_order, is_active")
        .eq("restaurant_id", rid)
        .order("sort_order", { ascending: true }),
      sb
        .from("menu_items")
        .select(
          "id, category_id, name, description, price, vat_rate, is_active, side_price_cents, list_number",
        )
        .eq("restaurant_id", rid)
        .eq("is_active", true)
        .order("list_number", { ascending: true }),
      sb
        .from("menu_option_groups")
        .select("id, name, min_select, max_select, sort_order, is_active")
        .eq("restaurant_id", rid)
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
      sb
        .from("menu_option_choices")
        .select("id, option_group_id, name, price_delta, sort_order, is_active"),
      sb.from("menu_item_option_groups").select("menu_item_id, option_group_id, sort_order"),
      sb
        .from("menu_item_side_config")
        .select("menu_item_id, required, max_sides, included_count")
        .eq("restaurant_id", rid),
    ]);

    const groupIds = new Set((groups ?? []).map((g) => g.id as string));
    const itemIds = new Set((items ?? []).map((i) => i.id as string));

    const sideByItem = new Map(
      (sideConfigs ?? []).map((c) => [
        c.menu_item_id as string,
        {
          required: Boolean(c.required),
          max: Number(c.max_sides),
          includedCount: Number(c.included_count),
        },
      ]),
    );

    const choicesByGroup = new Map<string, Array<{
      id: string;
      name: string;
      deltaCents: number;
      sortOrder: number;
    }>>();
    for (const c of choices ?? []) {
      const gid = c.option_group_id as string;
      if (!groupIds.has(gid) || c.is_active === false) continue;
      const list = choicesByGroup.get(gid) ?? [];
      list.push({
        id: c.id as string,
        name: c.name as string,
        deltaCents: Math.round(Number(c.price_delta ?? 0) * 100),
        sortOrder: Number(c.sort_order ?? 0),
      });
      choicesByGroup.set(gid, list);
    }

    const itemIdsByGroup = new Map<string, string[]>();
    for (const l of links ?? []) {
      const gid = l.option_group_id as string;
      const mid = l.menu_item_id as string;
      if (!groupIds.has(gid) || !itemIds.has(mid)) continue;
      const list = itemIdsByGroup.get(gid) ?? [];
      list.push(mid);
      itemIdsByGroup.set(gid, list);
    }

    return {
      restaurantId: rid,
      categories: categories ?? [],
      items: (items ?? []).map((it) => {
        const priceCents = Math.round(Number(it.price ?? 0) * 100);
        return {
          id: it.id,
          categoryId: it.category_id,
          name: it.name,
          description: it.description,
          priceCents,
          sidePriceCents:
            it.side_price_cents == null ? null : Number(it.side_price_cents),
          vatRate: Number(it.vat_rate ?? 19),
          sides: sideByItem.get(it.id as string) ?? null,
        };
      }),
      optionGroups: (groups ?? []).map((g) => ({
        id: g.id,
        name: g.name,
        minSelect: Number(g.min_select ?? 0),
        maxSelect: g.max_select == null ? null : Number(g.max_select),
        sortOrder: Number(g.sort_order ?? 0),
        choices: (choicesByGroup.get(g.id as string) ?? []).sort(
          (a, b) => a.sortOrder - b.sortOrder,
        ),
        menuItemIds: itemIdsByGroup.get(g.id as string) ?? [],
      })),
    };
  }
}
