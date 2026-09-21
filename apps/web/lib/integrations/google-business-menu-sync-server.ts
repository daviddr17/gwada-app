import "server-only";

import {
  DEFAULT_MENU_CURRENCY_CODE,
  normalizeMenuCurrencyCode,
} from "@/lib/constants/menu-currencies";
import {
  fetchWithGoogleBusinessAuth,
  getGoogleBusinessAccessTokenForRestaurant,
  googleLocationResourceName,
  googleReviewsParentPath,
} from "@/lib/integrations/google-business-access";
import {
  buildGoogleFoodMenusBody,
  googleFoodMenuErrorCode,
  googleFoodMenusResourceName,
  selectGoogleMenuSections,
  type GoogleMenuCategoryCandidate,
  type GoogleMenuItemCandidate,
} from "@/lib/integrations/google-business-menu-payload";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fetchRestaurantTimezoneServer } from "@/lib/supabase/restaurant-timezone-server";

type GoogleErrorBody = {
  error?: {
    message?: string;
    status?: string;
    details?: Array<{ reason?: string; message?: string }>;
  };
  metadata?: { canHaveFoodMenus?: boolean };
};

function googleErrorText(payload: GoogleErrorBody): string {
  return [
    payload.error?.message,
    payload.error?.status,
    ...(payload.error?.details ?? []).flatMap((detail) => [
      detail.reason,
      detail.message,
    ]),
  ]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(" ");
}

async function locationCanHaveFoodMenus(
  restaurantId: string,
  locationName: string,
): Promise<boolean | null> {
  const url = `https://mybusinessbusinessinformation.googleapis.com/v1/${locationName}?readMask=metadata`;
  const res = await fetchWithGoogleBusinessAuth(restaurantId, url);
  if ("error" in res || !res.ok) return null;
  const payload = (await res.json().catch(() => ({}))) as GoogleErrorBody;
  const flag = payload.metadata?.canHaveFoodMenus;
  return typeof flag === "boolean" ? flag : null;
}

export async function syncMenuToGoogleBusiness(
  restaurantId: string,
): Promise<{ ok: true; itemCount: number } | { ok: false; error: string }> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "server_misconfigured" };

  const auth = await getGoogleBusinessAccessTokenForRestaurant(restaurantId);
  if ("error" in auth) {
    return { ok: false, error: auth.error };
  }

  const parent = googleReviewsParentPath(auth.config);
  if (!parent) {
    return { ok: false, error: "google_location_missing" };
  }

  const locationRaw = auth.config.location_name?.trim();
  if (locationRaw) {
    const canHave = await locationCanHaveFoodMenus(
      restaurantId,
      googleLocationResourceName(locationRaw),
    );
    if (canHave === false) {
      return { ok: false, error: "google_food_menu_unsupported" };
    }
  }

  const [settingsRes, itemsRes, categoriesRes, mainsRes] = await Promise.all([
    admin
      .from("restaurant_menu_settings")
      .select("currency_code")
      .eq("restaurant_id", restaurantId)
      .maybeSingle(),
    admin
      .from("menu_items")
      .select(
        "id, name, description, price, is_active, category_id, available_from, available_to",
      )
      .eq("restaurant_id", restaurantId)
      .eq("is_active", true)
      .order("category_id", { ascending: true })
      .order("list_number", { ascending: true }),
    admin
      .from("menu_categories")
      .select("id, name, is_active, sort_order, main_category_id")
      .eq("restaurant_id", restaurantId)
      .eq("is_active", true),
    admin
      .from("menu_main_categories")
      .select("id, is_active, sort_order")
      .eq("restaurant_id", restaurantId)
      .eq("is_active", true),
  ]);

  const queryError =
    settingsRes.error ?? itemsRes.error ?? categoriesRes.error ?? mainsRes.error;
  if (queryError) {
    return { ok: false, error: queryError.message };
  }

  const currencyCode = normalizeMenuCurrencyCode(
    (settingsRes.data?.currency_code as string | undefined) ??
      DEFAULT_MENU_CURRENCY_CODE,
  );

  const mainById = new Map(
    (mainsRes.data ?? []).map((row) => [
      row.id,
      { active: row.is_active, sortOrder: row.sort_order },
    ]),
  );

  const categories: GoogleMenuCategoryCandidate[] = (categoriesRes.data ?? []).map(
    (row) => {
      const main = mainById.get(row.main_category_id);
      return {
        id: row.id,
        name: row.name,
        active: row.is_active,
        sortOrder: row.sort_order,
        mainCategoryId: row.main_category_id,
        mainActive: main?.active === true,
        mainSortOrder: main?.sortOrder ?? 0,
      };
    },
  );

  const items: GoogleMenuItemCandidate[] = (itemsRes.data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    price: Number(row.price),
    active: row.is_active,
    categoryId: row.category_id,
    availableFrom: row.available_from,
    availableTo: row.available_to,
  }));

  const restaurantTimeZone = await fetchRestaurantTimezoneServer(admin, restaurantId);
  const sections = selectGoogleMenuSections(
    items,
    categories,
    new Date(),
    restaurantTimeZone,
  );
  const itemCount = sections.reduce((sum, section) => sum + section.items.length, 0);
  if (itemCount === 0) {
    return { ok: false, error: "menu_empty" };
  }

  const resourceName = googleFoodMenusResourceName(parent);
  const url = `https://mybusiness.googleapis.com/v4/${resourceName}?updateMask=menus`;
  const res = await fetchWithGoogleBusinessAuth(restaurantId, url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      buildGoogleFoodMenusBody({
        resourceName,
        currencyCode,
        sections,
      }),
    ),
  });
  if ("error" in res) {
    return { ok: false, error: res.error };
  }

  const payload = (await res.json().catch(() => ({}))) as GoogleErrorBody;
  if (!res.ok) {
    return {
      ok: false,
      error: googleFoodMenuErrorCode(res.status, googleErrorText(payload)),
    };
  }

  return { ok: true, itemCount };
}
