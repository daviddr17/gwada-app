import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { normalizeMenuAvailabilityYmd } from "@/lib/menu/item-utils";
import {
  getWorkspaceRestaurantId,
  workspacePersistenceConfigured,
} from "@/lib/supabase/workspace-persistence";
import type {
  MenuCategoryDefinition,
  MenuItem,
  MenuMainCategoryDefinition,
  MenuOptionChoice,
  MenuOptionGroup,
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
  available_from: string | null;
  available_to: string | null;
  menu_item_tags: { tag_id: string }[] | null;
  menu_item_allergens: { allergen_id: string }[] | null;
  menu_item_recipe_lines:
    | { ingredient_id: string; amount: number | string }[]
    | null;
  menu_item_option_groups:
    | { option_group_id: string; sort_order: number }[]
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
  const optionLinks = [...(row.menu_item_option_groups ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order,
  );
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
    optionGroupIds: optionLinks.map((x) => x.option_group_id),
    availableFrom: normalizeMenuAvailabilityYmd(row.available_from),
    availableTo: normalizeMenuAvailabilityYmd(row.available_to),
  };
}

export async function loadMenuMainCategoriesRelational(
  restaurantId?: string | null,
): Promise<MenuMainCategoryDefinition[] | null> {
  const rid = restaurantId ?? (await getWorkspaceRestaurantId());
  if (!rid) return null;
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("menu_main_categories")
    .select("id,name,is_active,sort_order")
    .eq("restaurant_id", rid)
    .order("sort_order", { ascending: true });
  if (error) {
    console.warn("[gwada] menu_main_categories", error.message);
    return null;
  }
  if (!data?.length) return [];
  return data.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    active: r.is_active as boolean,
  }));
}

export async function insertMenuMainCategory(
  restaurantId: string,
  name: string,
  active: boolean,
): Promise<{ id: string } | null> {
  const supabase = createSupabaseBrowserClient();
  const { data: last } = await supabase
    .from("menu_main_categories")
    .select("sort_order")
    .eq("restaurant_id", restaurantId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sortOrder = (last?.sort_order ?? -1) + 1;
  const { data, error } = await supabase
    .from("menu_main_categories")
    .insert({
      restaurant_id: restaurantId,
      name,
      is_active: active,
      sort_order: sortOrder,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.warn("[gwada] insert menu_main_categories", error?.message);
    return null;
  }
  return { id: data.id as string };
}

export async function updateMenuMainCategoryRow(
  id: string,
  updates: { name?: string; active?: boolean },
): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  const patch: Record<string, unknown> = {};
  if (updates.name !== undefined) patch.name = updates.name.trim();
  if (updates.active !== undefined) patch.is_active = updates.active;
  if (Object.keys(patch).length === 0) return true;
  const { error } = await supabase
    .from("menu_main_categories")
    .update(patch)
    .eq("id", id);
  if (error) {
    console.warn("[gwada] update menu_main_categories", error.message);
    return false;
  }
  return true;
}

export async function reorderMenuMainCategoryRows(
  orderedIds: string[],
): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from("menu_main_categories")
      .update({ sort_order: i })
      .eq("id", orderedIds[i]);
    if (error) {
      console.warn("[gwada] reorder menu_main_categories", error.message);
      return false;
    }
  }
  return true;
}

export async function deleteMenuMainCategory(
  id: string,
): Promise<"ok" | "in_use" | "error"> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase
    .from("menu_main_categories")
    .delete()
    .eq("id", id);
  if (!error) return "ok";
  if (error.code === "23503") return "in_use";
  console.warn("[gwada] delete menu_main_categories", error.message);
  return "error";
}

export async function loadMenuCategoriesRelational(
  restaurantId?: string | null,
): Promise<
  MenuCategoryDefinition[] | null
> {
  const rid = restaurantId ?? (await getWorkspaceRestaurantId());
  if (!rid) return null;
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("menu_categories")
    .select("id,name,is_active,sort_order,main_category_id")
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
    mainCategoryId: r.main_category_id as string,
  }));
}

export async function insertMenuCategory(
  restaurantId: string,
  name: string,
  active: boolean,
  mainCategoryId: string,
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
      main_category_id: mainCategoryId,
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
  updates: { name?: string; active?: boolean; mainCategoryId?: string },
): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  const patch: Record<string, unknown> = {};
  if (updates.name !== undefined) patch.name = updates.name.trim();
  if (updates.active !== undefined) patch.is_active = updates.active;
  if (updates.mainCategoryId !== undefined) {
    patch.main_category_id = updates.mainCategoryId;
  }
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
  restaurantId?: string | null,
): Promise<MenuTaxonomyDefinition[] | null> {
  const rid = restaurantId ?? (await getWorkspaceRestaurantId());
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

export async function deleteMenuCategory(
  id: string,
): Promise<"ok" | "in_use" | "error"> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.from("menu_categories").delete().eq("id", id);
  if (!error) return "ok";
  if (error.code === "23503") return "in_use";
  console.warn("[gwada] delete menu_categories", error.message);
  return "error";
}

export async function deleteMenuTaxonomyRow(
  table: "menu_tags" | "menu_allergens",
  id: string,
): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) {
    console.warn(`[gwada] delete ${table}`, error.message);
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
  item: Pick<MenuItem, "tags" | "recipe" | "optionGroupIds">,
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
  const { error: d4 } = await supabase
    .from("menu_item_option_groups")
    .delete()
    .eq("menu_item_id", menuItemId);
  if (d4) {
    console.warn("[gwada] delete menu_item_option_groups", d4.message);
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
  const optionGroupIds = item.optionGroupIds ?? [];
  if (optionGroupIds.length) {
    const { error } = await supabase.from("menu_item_option_groups").insert(
      optionGroupIds.map((option_group_id, i) => ({
        menu_item_id: menuItemId,
        option_group_id,
        sort_order: i,
      })),
    );
    if (error) {
      console.warn("[gwada] insert menu_item_option_groups", error.message);
      return false;
    }
  }
  return true;
}

export async function loadMenuItemsRelational(
  restaurantId?: string | null,
): Promise<MenuItem[] | null> {
  const rid = restaurantId ?? (await getWorkspaceRestaurantId());
  if (!rid) return null;
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("menu_items")
    .select(
      `
      id, name, description, price, image_url, is_active, list_number, category_id,
      available_from, available_to,
      menu_item_tags(tag_id),
      menu_item_allergens(allergen_id),
      menu_item_recipe_lines(ingredient_id, amount),
      menu_item_option_groups(option_group_id, sort_order)
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
    available_from: normalizeMenuAvailabilityYmd(item.availableFrom),
    available_to: normalizeMenuAvailabilityYmd(item.availableTo),
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
      available_from: normalizeMenuAvailabilityYmd(item.availableFrom),
      available_to: normalizeMenuAvailabilityYmd(item.availableTo),
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

type OptionGroupRow = {
  id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
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

function rowToOptionGroup(row: OptionGroupRow): MenuOptionGroup {
  const choices = [...(row.menu_option_choices ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(
      (c): MenuOptionChoice => ({
        id: c.id,
        name: c.name,
        priceDelta: Number(c.price_delta),
        active: c.is_active,
      }),
    );
  return {
    id: row.id,
    name: row.name,
    active: row.is_active,
    minSelect: row.min_select,
    maxSelect: row.max_select,
    choices,
  };
}

export async function loadMenuOptionGroupsRelational(
  restaurantId?: string | null,
): Promise<MenuOptionGroup[] | null> {
  const rid = restaurantId ?? (await getWorkspaceRestaurantId());
  if (!rid) return null;
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("menu_option_groups")
    .select(
      `
      id, name, is_active, sort_order, min_select, max_select,
      menu_option_choices(id, name, price_delta, is_active, sort_order)
    `,
    )
    .eq("restaurant_id", rid)
    .order("sort_order", { ascending: true });
  if (error) {
    console.warn("[gwada] menu_option_groups", error.message);
    return null;
  }
  if (!data?.length) return [];
  return (data as unknown as OptionGroupRow[]).map(rowToOptionGroup);
}

export type MenuOptionGroupSaveInput = {
  name: string;
  active: boolean;
  minSelect: number;
  maxSelect: number | null;
  choices: {
    id?: string;
    name: string;
    priceDelta: number;
    active: boolean;
  }[];
};

async function replaceOptionChoices(
  groupId: string,
  choices: MenuOptionGroupSaveInput["choices"],
): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  const { error: delErr } = await supabase
    .from("menu_option_choices")
    .delete()
    .eq("option_group_id", groupId);
  if (delErr) {
    console.warn("[gwada] delete menu_option_choices", delErr.message);
    return false;
  }
  if (!choices.length) return true;
  const { error } = await supabase.from("menu_option_choices").insert(
    choices.map((c, i) => ({
      ...(c.id ? { id: c.id } : {}),
      option_group_id: groupId,
      name: c.name.trim(),
      price_delta: c.priceDelta,
      is_active: c.active,
      sort_order: i,
    })),
  );
  if (error) {
    console.warn("[gwada] insert menu_option_choices", error.message);
    return false;
  }
  return true;
}

export async function insertMenuOptionGroupRelational(
  restaurantId: string,
  input: MenuOptionGroupSaveInput,
): Promise<{ id: string } | null> {
  const supabase = createSupabaseBrowserClient();
  const { data: last } = await supabase
    .from("menu_option_groups")
    .select("sort_order")
    .eq("restaurant_id", restaurantId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sortOrder = (last?.sort_order ?? -1) + 1;
  const { data, error } = await supabase
    .from("menu_option_groups")
    .insert({
      restaurant_id: restaurantId,
      name: input.name.trim(),
      is_active: input.active,
      min_select: input.minSelect,
      max_select: input.maxSelect,
      sort_order: sortOrder,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.warn("[gwada] insert menu_option_groups", error?.message);
    return null;
  }
  const id = data.id as string;
  const ok = await replaceOptionChoices(id, input.choices);
  if (!ok) {
    await supabase.from("menu_option_groups").delete().eq("id", id);
    return null;
  }
  return { id };
}

export async function updateMenuOptionGroupRelational(
  id: string,
  input: MenuOptionGroupSaveInput,
): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase
    .from("menu_option_groups")
    .update({
      name: input.name.trim(),
      is_active: input.active,
      min_select: input.minSelect,
      max_select: input.maxSelect,
    })
    .eq("id", id);
  if (error) {
    console.warn("[gwada] update menu_option_groups", error.message);
    return false;
  }
  return replaceOptionChoices(id, input.choices);
}

export async function deleteMenuOptionGroupRelational(
  id: string,
): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase
    .from("menu_option_groups")
    .delete()
    .eq("id", id);
  if (error) {
    console.warn("[gwada] delete menu_option_groups", error.message);
    return false;
  }
  return true;
}

export async function reorderMenuOptionGroupsRelational(
  orderedIds: string[],
): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from("menu_option_groups")
      .update({ sort_order: i })
      .eq("id", orderedIds[i]);
    if (error) {
      console.warn("[gwada] reorder menu_option_groups", error.message);
      return false;
    }
  }
  return true;
}
