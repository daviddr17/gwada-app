import { normalizeAppLocale, type AppLocale } from "@/i18n/config";
import { resolveInventoryNotificationLocale } from "@/lib/inventory/inventory-unit-label-for-locale";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Staff and owners: their profile language, else the restaurant language. */
export function staffNotificationLocale(
  profileLocale: string | null | undefined,
  restaurantLocale: string | null | undefined,
): AppLocale {
  return resolveInventoryNotificationLocale(profileLocale, restaurantLocale);
}

/**
 * Guests: the language chosen for that booking, else a logged-in guest profile,
 * else the restaurant language.
 */
export function guestNotificationLocale(params: {
  guestLocale?: string | null;
  profileLocale?: string | null;
  restaurantLocale?: string | null;
}): AppLocale {
  const chosen = params.guestLocale?.trim() || params.profileLocale?.trim() || null;
  return resolveInventoryNotificationLocale(chosen, params.restaurantLocale);
}

export async function loadGuestNotificationLocale(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    guestLocale?: string | null;
    guestProfileId?: string | null;
  },
): Promise<AppLocale> {
  let profileLocale: string | null = null;
  if (params.guestProfileId) {
    const { data } = await sb
      .from("profiles")
      .select("locale")
      .eq("id", params.guestProfileId)
      .maybeSingle();
    profileLocale =
      typeof data?.locale === "string" ? data.locale : null;
  }
  const { data: restaurant } = await sb
    .from("restaurants")
    .select("default_locale")
    .eq("id", params.restaurantId)
    .maybeSingle();
  const restaurantLocale =
    typeof restaurant?.default_locale === "string"
      ? restaurant.default_locale
      : null;
  return guestNotificationLocale({
    guestLocale: params.guestLocale,
    profileLocale,
    restaurantLocale,
  });
}

export function normalizeStoredGuestLocale(
  value: string | null | undefined,
): AppLocale | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return normalizeAppLocale(trimmed);
}
