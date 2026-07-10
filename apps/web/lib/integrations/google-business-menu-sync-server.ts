import "server-only";

import {
  DEFAULT_MENU_CURRENCY_CODE,
  normalizeMenuCurrencyCode,
} from "@/lib/constants/menu-currencies";
import {
  getGoogleBusinessAccessTokenForRestaurant,
  googleReviewsParentPath,
} from "@/lib/integrations/google-business-access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fetchRestaurantTimezoneServer } from "@/lib/supabase/restaurant-timezone-server";
import { isMenuItemPubliclyAvailable } from "@/lib/menu/item-utils";

type MenuRow = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  is_active: boolean;
  category_id: string;
  available_from: string | null;
  available_to: string | null;
  menu_categories: { name: string; sort_order: number } | { name: string; sort_order: number }[] | null;
};

function priceToGoogleMoney(
  price: number,
  currencyCode: string,
): {
  currencyCode: string;
  units: string;
  nanos: number;
} {
  const safe = Math.max(0, price);
  const units = Math.floor(safe);
  const nanos = Math.round((safe - units) * 1e9);
  return { currencyCode, units: String(units), nanos };
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

  const { data: settingsRow } = await admin
    .from("restaurant_menu_settings")
    .select("currency_code")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  const currencyCode = normalizeMenuCurrencyCode(
    (settingsRow?.currency_code as string | undefined) ?? DEFAULT_MENU_CURRENCY_CODE,
  );

  const { data: rows, error: menuErr } = await admin
    .from("menu_items")
    .select(
      "id, name, description, price, is_active, category_id, available_from, available_to, menu_categories(name, sort_order)",
    )
    .eq("restaurant_id", restaurantId)
    .eq("is_active", true)
    .order("category_id", { ascending: true })
    .order("list_number", { ascending: true });

  if (menuErr) {
    return { ok: false, error: menuErr.message };
  }

  const restaurantTimeZone = await fetchRestaurantTimezoneServer(admin, restaurantId);

  const items = (rows ?? []).filter((item) =>
    isMenuItemPubliclyAvailable({
      id: item.id,
      name: item.name,
      description: item.description ?? "",
      price: Number(item.price),
      category: item.category_id,
      imageUrl: "",
      tags: [],
      active: item.is_active,
      availableFrom: item.available_from,
      availableTo: item.available_to,
    }, new Date(), restaurantTimeZone),
  ) as MenuRow[];
  if (items.length === 0) {
    return { ok: false, error: "menu_empty" };
  }

  const sectionsMap = new Map<
    string,
    { title: string; sort: number; items: MenuRow[] }
  >();

  for (const item of items) {
    const catRaw = item.menu_categories;
    const cat = Array.isArray(catRaw) ? catRaw[0] : catRaw;
    const key = item.category_id;
    const existing = sectionsMap.get(key);
    if (existing) {
      existing.items.push(item);
    } else {
      sectionsMap.set(key, {
        title: cat?.name?.trim() || "Speisekarte",
        sort: cat?.sort_order ?? 0,
        items: [item],
      });
    }
  }

  const sections = [...sectionsMap.values()]
    .sort((a, b) => a.sort - b.sort)
    .map((section) => ({
      labels: [{ displayName: section.title, languageCode: "de" }],
      items: section.items.map((item) => ({
        labels: [{ displayName: item.name.trim(), languageCode: "de" }],
        attributes: {
          price: priceToGoogleMoney(Number(item.price), currencyCode),
        },
        ...(item.description?.trim()
          ? {
              description: {
                text: item.description.trim(),
                languageCode: "de",
              },
            }
          : {}),
      })),
    }));

  const foodMenus = {
    menus: [
      {
        labels: [{ displayName: "Speisekarte", languageCode: "de" }],
        sections,
      },
    ],
  };

  const url = `https://mybusiness.googleapis.com/v4/${parent}/foodMenus`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(foodMenus),
    cache: "no-store",
  });

  const payload = (await res.json().catch(() => ({}))) as {
    error?: { message?: string };
  };

  if (!res.ok) {
    return {
      ok: false,
      error: payload.error?.message ?? `google_menu_${res.status}`,
    };
  }

  return { ok: true, itemCount: items.length };
}
