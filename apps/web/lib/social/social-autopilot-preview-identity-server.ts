import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveRestaurantProfileImageSignedUrl } from "@/lib/restaurant/restaurant-profile-image";
import { DEFAULT_ACCENT_HEX } from "@/lib/theme/constants";
import { normalizeHex } from "@/lib/theme/color-utils";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

/** Restaurant-Identität für die Autopilot-Live-Vorschau (kein LLM). */
export type SocialAutopilotPreviewIdentity = {
  name: string;
  logoUrl: string | null;
  coverUrl: string | null;
  accentHex: string;
};

export async function fetchSocialAutopilotPreviewIdentity(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<SocialAutopilotPreviewIdentity | null> {
  if (!isUuidRestaurantId(restaurantId)) return null;

  const { data } = await sb
    .from("restaurants")
    .select(
      "name, brand_accent_hex, avatar_storage_path, cover_storage_path",
    )
    .eq("id", restaurantId)
    .maybeSingle();

  if (!data) return null;

  const name =
    (typeof data.name === "string" && data.name.trim()) || "Euer Restaurant";
  const accentHex =
    normalizeHex(String(data.brand_accent_hex ?? "")) ?? DEFAULT_ACCENT_HEX;

  const [logoUrl, coverUrl] = await Promise.all([
    resolveRestaurantProfileImageSignedUrl(
      sb,
      typeof data.avatar_storage_path === "string"
        ? data.avatar_storage_path
        : null,
      7200,
    ),
    resolveRestaurantProfileImageSignedUrl(
      sb,
      typeof data.cover_storage_path === "string"
        ? data.cover_storage_path
        : null,
      7200,
    ),
  ]);

  return {
    name,
    logoUrl,
    coverUrl,
    accentHex,
  };
}
