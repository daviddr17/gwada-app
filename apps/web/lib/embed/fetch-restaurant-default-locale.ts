import "server-only";

import type { AppLocale } from "@/i18n/config";
import { parseRestaurantDefaultLocale } from "@/lib/embed/embed-locale";
import { normalizeRestaurantSlugInput } from "@/lib/restaurant/restaurant-slug";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function fetchRestaurantDefaultLocaleForSlug(
  slugInput: string,
): Promise<AppLocale> {
  const admin = createSupabaseAdminClient();
  if (!admin) return "de";

  const slug = normalizeRestaurantSlugInput(slugInput);
  if (!slug) return "de";

  const { data } = await admin
    .from("restaurants")
    .select("default_locale")
    .eq("slug", slug)
    .maybeSingle();

  return parseRestaurantDefaultLocale(
    typeof data?.default_locale === "string" ? data.default_locale : null,
  );
}
