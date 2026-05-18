import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  getWorkspaceRestaurantId,
  workspacePersistenceConfigured,
} from "@/lib/supabase/workspace-persistence";
import type {
  MenuCategoryDefinition,
  MenuItem,
  MenuTaxonomyDefinition,
} from "@/lib/types/menu";

/** Menu cards + taxonomy live in normalized tables when Supabase env is set. */
export function menuRelationalPersistenceEnabled(): boolean {
  return workspacePersistenceConfigured();
}

type MenuItemRow = {
  id: string;
  name: string;
  description: string;
  price: number | string;
  image_url: string;
  is_active: boolean;
  list_number: number | null;
  category_id: string;
  menu_item_tags: { tag_id: string }[] | null;
  menu_item_allergens: { allergen_id: string }[] | null;
  menu_item_recipe_lines:
    | { ingredient_id: string; amount: number | string }[]
    | null;
};

function rowToMenuItem(row: MenuItemRow): MenuItem {
  const tagIds = (row.menu_item_tags ?? []).map((x) => x.tag_id);
  const allergenIds = (row.menu_item_allergens ?? []).map((x) => x.allergen_id);
  const lines = row.menu_item_recipe_lines ?? [];
  const recipe =
    lines.length > 0
      ? lines.map((l) => ({
          ingredientId: l.ingredient_id,
          amount: Number(l.amount),
        }))
      : null;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: Number(row.price),
    category: row.category_id,
    imageUrl: row.image_url,
    tags: [...tagIds, ...allergenIds],
    active: row.is_active,
    listNumber: row.list_number,
    recipe,
  };
}

export async function loadMenuCategoriesRelational(): Promise<
  MenuCategoryDefinition[] | null
> {
  const rid = await getWorkspaceRestaurantId();
  if (!rid) return null;
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("menu_categories")
    .select("id,name,is_active,sort_order")
    .eq("restaurant_id", rid)
    .order("sort_order", { ascending: true });
  if (error) {
    console.warn("[gwada] menu_categories", error.message);
    return null;
  }
  if (!data?.length) return [];
  return data.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    active: r.is_active as boolean,
  }));
}

export async function insertMenuCategory(
  restaurantId: string,
  name: string,
  active: boolean,
): Promise<{ id: string } | null> {
  const supabase = createSupabaseBrowserClient();
  const { data: last } = await supabase
    .from("menu_categories")
    .select("sort_order")
    .eq("restaurant_id", restaurantId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sortOrder = (last?.sort_order ?? -1) + 1;
  const { data, error } = await supabase
    .from("menu_categories")
    .insert({
      restaurant_id: restaurantId,
      name,
      is_active: active,
      sort_order: sortOrder,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.warn("[gwada] insert menu_categories", error?.message);
    return null;
  }
  return { id: data.id as string };
}

export async function updateMenuCategoryRow(
  id: string,
  updates: { name?: string; active?: boolean },
): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  const patch: Record<string, unknown> = {};
  if (updates.name !== undefined) patch.name = updates.name.trim();
  if (updates.active !== undefined) patch.is_active = updates.active;
  if (Object.keys(patch).length === 0) return true;
  const { error } = await supabase.from("menu_categories").update(patch).eq("id", id);
  if (error) {
    console.warn("[gwada] update menu_categories", error.message);
    return false;
  }
  return true;
}

export async function reorderMenuCategoryRows(
  orderedIds: string[],
): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from("menu_categories")
      .update({ sort_order: i })
      .eq("id", orderedIds[i]);
    if (error) {
      console.warn("[gwada] reorder menu_categories", error.message);
      return false;
    }
  }
  return true;
}

export async function loadMenuTaxonomyRelational(
  table: "menu_tags" | "menu_allergens",
): Promise<MenuTaxonomyDefinition[] | null> {
  const rid = await getWorkspaceRestaurantId();
  if (!rid) return null;
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from(table)
    .select("id,name,is_active,sort_order,background_color")
    .eq("restaurant_id", rid)
    .order("sort_order", { ascending: true });
  if (error) {
    console.warn(`[gwada] ${table}`, error.message);
    return null;
  }
  if (!data?.length) return [];
  return data.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    active: r.is_active as boolean,
    backgroundColor: (r.background_color as string) || "#64748b",
  }));
}

export async function insertMenuTaxonomyRow(
  table: "menu_tags" | "menu_allergens",
  restaurantId: string,
  name: string,
  active: boolean,
  backgroundColor: string,
): Promise<{ id: string } | null> {
  const supabase = createSupabaseBrowserClient();
  const { data: last } = await supabase
    .from(table)
    .select("sort_order")
    .eq("restaurant_id", restaurantId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sortOrder = (last?.sort_order ?? -1) + 1;
  const { data, error } = await supabase
    .from(table)
    .insert({
      restaurant_id: restaurantId,
      name,
      is_active: active,
      background_color: backgroundColor,
      sort_order: sortOrder,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.warn(`[gwada] insert ${table}`, error?.message);
    return null;
  }
  return { id: data.id as string };
}

export async function updateMenuTaxonomyRow(
  table: "menu_tags" | "menu_allergens",
  id: string,
  updates: {
    name?: string;
    active?: boolean;
    backgroundColor?: string;
  },
): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  const patch: Record<string, unknown> = {};
  if (updates.name !== undefined) patch.name = updates.name.trim();
  if (updates.active !== undefined) patch.is_active = updates.active;
  if (updates.backgroundColor !== undefined) {
    patch.background_color = updates.backgroundColor;
  }
  if (Object.keys(patch).length === 0) return true;
  const { error } = await supabase.from(table).update(patch).eq("id", id);
  if (error) {
    console.warn(`[gwada] update ${table}`, error.message);
    return false;
  }
  return true;
}

export async function reorderMenuTaxonomyRows(
  table: "menu_tags" | "menu_allergens",
  orderedIds: string[],
): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from(table)
      .update({ sort_order: i })
      .eq("id", orderedIds[i]);
    if (error) {
      console.warn(`[gwada] reorder ${table}`, error.message);
      return false;
    }
  }
  return true;
}

async function fetchTagAndAllergenIdSets(
  restaurantId: string,
): Promise<{ tagIds: Set<string>; allergenIds: Set<string> }> {
  const supabase = createSupabaseBrowserClient();
  const [tagsRes, allRes] = await Promise.all([
    supabase.from("menu_tags").select("id").eq("restaurant_id", restaurantId),
    supabase.from("menu_allergens").select("id").eq("restaurant_id", restaurantId),
  ]);
  return {
    tagIds: new Set((tagsRes.data ?? []).map((r) => r.id as string)),
    allergenIds: new Set((allRes.data ?? []).map((r) => r.id as string)),
  };
}

function splitMenuItemTags(
  combined: string[],
  tagIds: Set<string>,
  allergenIds: Set<string>,
): { tagIds: string[]; allergenIds: string[] } {
  const outTags: string[] = [];
  const outAlg: string[] = [];
  for (const id of combined) {
    if (tagIds.has(id)) outTags.push(id);
    else if (allergenIds.has(id)) outAlg.push(id);
  }
  return { tagIds: outTags, allergenIds: outAlg };
}

async function replaceMenuItemRelations(
  restaurantId: string,
  menuItemId: string,
  item: Pick<MenuItem, "tags" | "recipe">,
): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  const { error: d1 } = await supabase
    .from("menu_item_tags")
    .delete()
    .eq("menu_item_id", menuItemId);
  if (d1) {
    console.warn("[gwada] delete menu_item_tags", d1.message);
    return false;
  }
  const { error: d2 } = await supabase
    .from("menu_item_allergens")
    .delete()
    .eq("menu_item_id", menuItemId);
  if (d2) {
    console.warn("[gwada] delete menu_item_allergens", d2.message);
    return false;
  }
  const { error: d3 } = await supabase
    .from("menu_item_recipe_lines")
    .delete()
    .eq("menu_item_id", menuItemId);
  if (d3) {
    console.warn("[gwada] delete menu_item_recipe_lines", d3.message);
    return false;
  }

  const sets = await fetchTagAndAllergenIdSets(restaurantId);
  const { tagIds: linkTags, allergenIds: linkAlg } = splitMenuItemTags(
    item.tags ?? [],
    sets.tagIds,
    sets.allergenIds,
  );

  if (linkTags.length) {
    const { error } = await supabase.from("menu_item_tags").insert(
      linkTags.map((tag_id) => ({ menu_item_id: menuItemId, tag_id })),
    );
    if (error) {
      console.warn("[gwada] insert menu_item_tags", error.message);
      return false;
    }
  }
  if (linkAlg.length) {
    const { error } = await supabase.from("menu_item_allergens").insert(
      linkAlg.map((allergen_id) => ({ menu_item_id: menuItemId, allergen_id })),
    );
    if (error) {
      console.warn("[gwada] insert menu_item_allergens", error.message);
      return false;
    }
  }
  const recipe = item.recipe ?? [];
  if (recipe.length) {
    const { error } = await supabase.from("menu_item_recipe_lines").insert(
      recipe.map((line, i) => ({
        menu_item_id: menuItemId,
        ingredient_id: line.ingredientId,
        amount: line.amount,
        sort_order: i,
      })),
    );
    if (error) {
      console.warn("[gwada] insert menu_item_recipe_lines", error.message);
      return false;
    }
  }
  return true;
}

export async function loadMenuItemsRelational(): Promise<MenuItem[] | null> {
  const rid = await getWorkspaceRestaurantId();
  if (!rid) return null;
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("menu_items")
    .select(
      `
      id, name, description, price, image_url, is_active, list_number, category_id,
      menu_item_tags(tag_id),
      menu_item_allergens(allergen_id),
      menu_item_recipe_lines(ingredient_id, amount)
    `,
    )
    .eq("restaurant_id", rid)
    .order("category_id", { ascending: true })
    .order("list_number", { ascending: true });
  if (error) {
    console.warn("[gwada] menu_items", error.message);
    return null;
  }
  if (!data?.length) return [];
  return (data as unknown as MenuItemRow[]).map(rowToMenuItem);
}

export async function insertMenuItemRelational(item: MenuItem): Promise<boolean> {
  const rid = await getWorkspaceRestaurantId();
  if (!rid) return false;
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.from("menu_items").insert({
    id: item.id,
    restaurant_id: rid,
    category_id: item.category,
    name: item.name,
    description: item.description,
    price: item.price,
    image_url: item.imageUrl,
    is_active: item.active !== false,
    list_number: item.listNumber ?? null,
  });
  if (error) {
    console.warn("[gwada] insert menu_items", error.message);
    return false;
  }
  const relOk = await replaceMenuItemRelations(rid, item.id, item);
  if (!relOk) {
    await supabase.from("menu_items").delete().eq("id", item.id);
    return false;
  }
  return true;
}

export async function updateMenuItemRelational(item: MenuItem): Promise<boolean> {
  const rid = await getWorkspaceRestaurantId();
  if (!rid) return false;
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase
    .from("menu_items")
    .update({
      category_id: item.category,
      name: item.name,
      description: item.description,
      price: item.price,
      image_url: item.imageUrl,
      is_active: item.active !== false,
      list_number: item.listNumber ?? null,
    })
    .eq("id", item.id);
  if (error) {
    console.warn("[gwada] update menu_items", error.message);
    return false;
  }
  return replaceMenuItemRelations(rid, item.id, item);
}

export async function deleteMenuItemRelational(id: string): Promise<boolean> {
  const rid = await getWorkspaceRestaurantId();
  if (!rid) return false;
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase
    .from("menu_items")
    .delete()
    .eq("id", id)
    .eq("restaurant_id", rid);
  if (error) {
    console.warn("[gwada] delete menu_items", error.message);
    return false;
  }
  return true;
}

export async function reorderMenuItemsInCategoryRelational(
  categoryId: string,
  orderedIds: string[],
): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from("menu_items")
      .update({ list_number: i + 1 })
      .eq("id", orderedIds[i])
      .eq("category_id", categoryId);
    if (error) {
      console.warn("[gwada] reorder menu_items", error.message);
      return false;
    }
  }
  return true;
}
