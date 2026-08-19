import "server-only";

import { parseEventPackageMoney } from "@/lib/events/event-package";
import {
  isEventMenuAddonBilling,
  isEventMenuCourseMode,
  isEventMenuDietKey,
  toPublicEventMenu,
  type EventMenu,
  type EventMenuAddon,
  type EventMenuCourse,
  type EventMenuCourseOption,
  type EventMenuDietKey,
  type EventMenuWriteFields,
  type PublicEventMenu,
} from "@/lib/events/event-menu";
import type { SupabaseClient } from "@supabase/supabase-js";

const MENU_COLUMNS =
  "id, restaurant_id, name, description, price_per_person, kids_price_per_person, tax_rate_percent, min_party_size, max_party_size, active, sort_order";

type MenuRow = {
  id: string;
  restaurant_id: string;
  name: string;
  description: string | null;
  price_per_person: number | string;
  kids_price_per_person: number | string | null;
  tax_rate_percent: number | string;
  min_party_size: number;
  max_party_size: number | null;
  active: boolean;
  sort_order: number;
};

type CourseRow = {
  id: string;
  menu_id: string;
  name: string;
  selection_mode: string;
  required: boolean;
  sort_order: number;
};

type OptionRow = {
  id: string;
  course_id: string;
  name: string;
  description: string | null;
  extra_price_per_person: number | string;
  diets: string[] | null;
  sort_order: number;
};

type AddonRow = {
  id: string;
  menu_id: string;
  name: string;
  description: string | null;
  price: number | string;
  billing: string;
  exclude_kids: boolean;
  sort_order: number;
};

function mapDiets(raw: string[] | null): EventMenuDietKey[] {
  if (!raw) return [];
  const out: EventMenuDietKey[] = [];
  for (const value of raw) {
    if (isEventMenuDietKey(value) && !out.includes(value)) out.push(value);
  }
  return out;
}

function mapOption(row: OptionRow): EventMenuCourseOption | null {
  return {
    id: row.id,
    name: row.name.trim(),
    description: (row.description ?? "").trim(),
    extraPricePerPerson: parseEventPackageMoney(row.extra_price_per_person),
    diets: mapDiets(row.diets),
    sortOrder: Number(row.sort_order) || 0,
  };
}

function mapCourse(
  row: CourseRow,
  options: EventMenuCourseOption[],
): EventMenuCourse | null {
  if (!isEventMenuCourseMode(row.selection_mode)) return null;
  return {
    id: row.id,
    name: row.name.trim(),
    selectionMode: row.selection_mode,
    required: row.required !== false,
    sortOrder: Number(row.sort_order) || 0,
    options: [...options].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "de")),
  };
}

function mapAddon(row: AddonRow): EventMenuAddon | null {
  if (!isEventMenuAddonBilling(row.billing)) return null;
  return {
    id: row.id,
    name: row.name.trim(),
    description: (row.description ?? "").trim(),
    price: parseEventPackageMoney(row.price),
    billing: row.billing,
    excludeKids: row.exclude_kids === true,
    sortOrder: Number(row.sort_order) || 0,
  };
}

function mapMenu(
  row: MenuRow,
  courses: EventMenuCourse[],
  addons: EventMenuAddon[],
): EventMenu {
  const kidsRaw = row.kids_price_per_person;
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    name: row.name.trim(),
    description: (row.description ?? "").trim(),
    pricePerPerson: parseEventPackageMoney(row.price_per_person),
    kidsPricePerPerson:
      kidsRaw == null || kidsRaw === ""
        ? null
        : parseEventPackageMoney(kidsRaw),
    taxRatePercent: parseEventPackageMoney(row.tax_rate_percent),
    minPartySize: Number(row.min_party_size) || 1,
    maxPartySize:
      row.max_party_size == null ? null : Number(row.max_party_size) || null,
    active: row.active !== false,
    sortOrder: Number(row.sort_order) || 0,
    courses: [...courses].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "de"),
    ),
    addons: [...addons].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "de"),
    ),
  };
}

function sortMenus(menus: EventMenu[]): EventMenu[] {
  return [...menus].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.name.localeCompare(b.name, "de");
  });
}

async function loadMenusByIds(
  sb: SupabaseClient,
  restaurantId: string,
  menuIds: string[] | null,
  activeOnly: boolean,
): Promise<{ menus: EventMenu[]; error: string | null }> {
  let query = sb
    .from("event_menus")
    .select(MENU_COLUMNS)
    .eq("restaurant_id", restaurantId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (activeOnly) query = query.eq("active", true);
  if (menuIds) query = query.in("id", menuIds);

  const { data: menuRows, error: menuError } = await query;
  if (menuError) {
    console.warn("[gwada] list event menus", menuError.message);
    return { menus: [], error: "list_failed" };
  }
  const menusRaw = (menuRows ?? []) as MenuRow[];
  if (menusRaw.length === 0) return { menus: [], error: null };

  const ids = menusRaw.map((row) => row.id);
  const { data: courseRows, error: courseError } = await sb
    .from("event_menu_courses")
    .select("id, menu_id, name, selection_mode, required, sort_order")
    .in("menu_id", ids);
  if (courseError) {
    console.warn("[gwada] list event menu courses", courseError.message);
    return { menus: [], error: "list_failed" };
  }
  const coursesRaw = (courseRows ?? []) as CourseRow[];
  const courseIds = coursesRaw.map((row) => row.id);

  let optionsRaw: OptionRow[] = [];
  if (courseIds.length > 0) {
    const { data: optionRows, error: optionError } = await sb
      .from("event_menu_course_options")
      .select(
        "id, course_id, name, description, extra_price_per_person, diets, sort_order",
      )
      .in("course_id", courseIds);
    if (optionError) {
      console.warn("[gwada] list event menu options", optionError.message);
      return { menus: [], error: "list_failed" };
    }
    optionsRaw = (optionRows ?? []) as OptionRow[];
  }

  const { data: addonRows, error: addonError } = await sb
    .from("event_menu_addons")
    .select(
      "id, menu_id, name, description, price, billing, exclude_kids, sort_order",
    )
    .in("menu_id", ids);
  if (addonError) {
    console.warn("[gwada] list event menu addons", addonError.message);
    return { menus: [], error: "list_failed" };
  }
  const addonsRaw = (addonRows ?? []) as AddonRow[];

  const optionsByCourse = new Map<string, EventMenuCourseOption[]>();
  for (const row of optionsRaw) {
    const mapped = mapOption(row);
    if (!mapped) continue;
    const list = optionsByCourse.get(row.course_id) ?? [];
    list.push(mapped);
    optionsByCourse.set(row.course_id, list);
  }

  const coursesByMenu = new Map<string, EventMenuCourse[]>();
  for (const row of coursesRaw) {
    const mapped = mapCourse(row, optionsByCourse.get(row.id) ?? []);
    if (!mapped) continue;
    const list = coursesByMenu.get(row.menu_id) ?? [];
    list.push(mapped);
    coursesByMenu.set(row.menu_id, list);
  }

  const addonsByMenu = new Map<string, EventMenuAddon[]>();
  for (const row of addonsRaw) {
    const mapped = mapAddon(row);
    if (!mapped) continue;
    const list = addonsByMenu.get(row.menu_id) ?? [];
    list.push(mapped);
    addonsByMenu.set(row.menu_id, list);
  }

  const menus = menusRaw.map((row) =>
    mapMenu(row, coursesByMenu.get(row.id) ?? [], addonsByMenu.get(row.id) ?? []),
  );
  return { menus: sortMenus(menus), error: null };
}

export async function listEventMenusForStaff(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<{ menus: EventMenu[]; error: string | null }> {
  return loadMenusByIds(sb, restaurantId, null, false);
}

export async function listActiveEventMenusPublic(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<PublicEventMenu[]> {
  const listed = await loadMenusByIds(sb, restaurantId, null, true);
  return listed.menus.filter((menu) => menu.active).map(toPublicEventMenu);
}

export async function loadActiveEventMenuById(
  sb: SupabaseClient,
  restaurantId: string,
  menuId: string,
): Promise<EventMenu | null> {
  const listed = await loadMenusByIds(sb, restaurantId, [menuId], true);
  return listed.menus[0] ?? null;
}

async function replaceMenuChildren(
  sb: SupabaseClient,
  menuId: string,
  input: EventMenuWriteFields,
): Promise<string | null> {
  const { error: deleteCoursesError } = await sb
    .from("event_menu_courses")
    .delete()
    .eq("menu_id", menuId);
  if (deleteCoursesError) {
    console.warn("[gwada] replace event menu courses", deleteCoursesError.message);
    return "save_failed";
  }
  const { error: deleteAddonsError } = await sb
    .from("event_menu_addons")
    .delete()
    .eq("menu_id", menuId);
  if (deleteAddonsError) {
    console.warn("[gwada] replace event menu addons", deleteAddonsError.message);
    return "save_failed";
  }

  if (input.courses.length > 0) {
    const { error: insertCoursesError } = await sb.from("event_menu_courses").insert(
      input.courses.map((course, index) => ({
        id: course.id,
        menu_id: menuId,
        name: course.name,
        selection_mode: course.selectionMode,
        required: course.required,
        sort_order: index,
      })),
    );
    if (insertCoursesError) {
      console.warn("[gwada] insert event menu courses", insertCoursesError.message);
      return "save_failed";
    }

    const optionRows = input.courses.flatMap((course, courseIndex) =>
      course.options.map((option, optionIndex) => ({
        id: option.id,
        course_id: course.id,
        name: option.name,
        description: option.description,
        extra_price_per_person: option.extraPricePerPerson,
        diets: option.diets,
        sort_order: optionIndex + courseIndex * 100,
      })),
    );
    if (optionRows.length > 0) {
      const { error: insertOptionsError } = await sb
        .from("event_menu_course_options")
        .insert(optionRows);
      if (insertOptionsError) {
        console.warn("[gwada] insert event menu options", insertOptionsError.message);
        return "save_failed";
      }
    }
  }

  if (input.addons.length > 0) {
    const { error: insertAddonsError } = await sb.from("event_menu_addons").insert(
      input.addons.map((addon, index) => ({
        id: addon.id,
        menu_id: menuId,
        name: addon.name,
        description: addon.description,
        price: addon.price,
        billing: addon.billing,
        exclude_kids: addon.excludeKids,
        sort_order: index,
      })),
    );
    if (insertAddonsError) {
      console.warn("[gwada] insert event menu addons", insertAddonsError.message);
      return "save_failed";
    }
  }
  return null;
}

function menuWriteRow(input: EventMenuWriteFields): Record<string, unknown> {
  return {
    name: input.name,
    description: input.description,
    price_per_person: input.pricePerPerson,
    kids_price_per_person: input.kidsPricePerPerson,
    tax_rate_percent: input.taxRatePercent,
    min_party_size: input.minPartySize,
    max_party_size: input.maxPartySize,
    active: input.active,
    sort_order: input.sortOrder,
  };
}

export async function createEventMenu(
  sb: SupabaseClient,
  restaurantId: string,
  input: EventMenuWriteFields,
): Promise<{ menu: EventMenu | null; error: string | null }> {
  const { data, error } = await sb
    .from("event_menus")
    .insert({ restaurant_id: restaurantId, ...menuWriteRow(input) })
    .select(MENU_COLUMNS)
    .single();
  if (error || !data) {
    console.warn("[gwada] create event menu", error?.message);
    return { menu: null, error: "create_failed" };
  }
  const childError = await replaceMenuChildren(sb, (data as MenuRow).id, input);
  if (childError) return { menu: null, error: childError };
  const loaded = await loadMenusByIds(sb, restaurantId, [(data as MenuRow).id], false);
  return { menu: loaded.menus[0] ?? null, error: loaded.error };
}

export async function updateEventMenu(
  sb: SupabaseClient,
  restaurantId: string,
  menuId: string,
  input: EventMenuWriteFields,
): Promise<{ menu: EventMenu | null; error: string | null }> {
  const { data, error } = await sb
    .from("event_menus")
    .update(menuWriteRow(input))
    .eq("restaurant_id", restaurantId)
    .eq("id", menuId)
    .select(MENU_COLUMNS)
    .maybeSingle();
  if (error) {
    console.warn("[gwada] update event menu", error.message);
    return { menu: null, error: "update_failed" };
  }
  if (!data) return { menu: null, error: "not_found" };
  const childError = await replaceMenuChildren(sb, menuId, input);
  if (childError) return { menu: null, error: childError };
  const loaded = await loadMenusByIds(sb, restaurantId, [menuId], false);
  return { menu: loaded.menus[0] ?? null, error: loaded.error };
}

export async function deleteEventMenu(
  sb: SupabaseClient,
  restaurantId: string,
  menuId: string,
): Promise<{ ok: boolean; error: string | null }> {
  const { error } = await sb
    .from("event_menus")
    .delete()
    .eq("restaurant_id", restaurantId)
    .eq("id", menuId);
  if (error) {
    console.warn("[gwada] delete event menu", error.message);
    return { ok: false, error: "delete_failed" };
  }
  return { ok: true, error: null };
}
