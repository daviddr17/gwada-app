import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { assertDisplayModuleAccess } from "@/lib/display/display-auth-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const access = await assertDisplayModuleAccess(cookieStore, "recipes");
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim().toLowerCase() ?? "";

  const [{ data: items, error: itemsError }, { data: ingredients, error: ingError }, { data: categories }] =
    await Promise.all([
      admin
        .from("menu_items")
        .select(
          `
          id, name, description, price, is_active, list_number, category_id,
          menu_item_recipe_lines ( ingredient_id, amount )
        `,
        )
        .eq("restaurant_id", access.restaurantId)
        .eq("is_active", true)
        .order("category_id")
        .order("list_number"),
      admin
        .from("inventory_ingredients")
        .select("id, name, unit")
        .eq("restaurant_id", access.restaurantId)
        .eq("is_active", true),
      admin
        .from("menu_categories")
        .select("id, name, is_active")
        .eq("restaurant_id", access.restaurantId)
        .order("sort_order"),
    ]);

  if (itemsError || ingError) {
    return NextResponse.json(
      { error: itemsError?.message ?? ingError?.message ?? "load_failed" },
      { status: 500 },
    );
  }

  const ingMap = new Map(
    (ingredients ?? []).map((i) => [
      i.id as string,
      { name: i.name as string, unit: i.unit as string },
    ]),
  );

  const catMap = new Map(
    (categories ?? []).map((c) => [c.id as string, c.name as string]),
  );

  let dishes = (items ?? []).map((item) => {
    const linesRaw = (item as Record<string, unknown>).menu_item_recipe_lines;
    const lines = (Array.isArray(linesRaw) ? linesRaw : []) as {
      ingredient_id: string;
      amount: number;
    }[];
    const recipe = lines.map((line) => {
      const ing = ingMap.get(line.ingredient_id);
      return {
        ingredient_id: line.ingredient_id,
        ingredient_name: ing?.name ?? line.ingredient_id,
        unit: ing?.unit ?? "",
        amount: Number(line.amount),
      };
    });
    return {
      id: item.id as string,
      name: item.name as string,
      description: (item.description as string) ?? "",
      price: Number(item.price),
      category_id: item.category_id as string,
      category_name: catMap.get(item.category_id as string) ?? "",
      recipe,
    };
  });

  if (q) {
    dishes = dishes.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q) ||
        d.recipe.some((r) => r.ingredient_name.toLowerCase().includes(q)),
    );
  }

  const dishCategoryIds = new Set(dishes.map((d) => d.category_id));
  const categoryList = (categories ?? [])
    .filter(
      (c) =>
        (c.is_active as boolean) !== false && dishCategoryIds.has(c.id as string),
    )
    .map((c) => ({ id: c.id as string, name: c.name as string }));

  return NextResponse.json({ dishes, categories: categoryList });
}
