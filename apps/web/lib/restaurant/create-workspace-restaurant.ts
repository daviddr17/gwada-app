import type { DayHours, Weekday } from "@/lib/types/restaurant";
import {
  RESTAURANT_SLUG_TAKEN_MESSAGE,
  restaurantSlugFromName,
} from "@/lib/restaurant/restaurant-slug";
import { isReservedRestaurantSlug } from "@/lib/restaurant/reserved-restaurant-slugs";
import { resolveRestaurantTimezone } from "@/lib/restaurant/restaurant-timezone";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { replaceOpeningHoursForRestaurant } from "@/lib/supabase/opening-hours-db";
import { seedRestaurantDefaultPositions } from "@/lib/supabase/restaurant-positions-db";
import { updateRestaurantBrandAccentHex } from "@/lib/supabase/restaurant-brand-accent";
import { isRestaurantSlugAvailable } from "@/lib/supabase/restaurant-stammdaten-db";
import {
  invalidateWorkspaceRestaurantCache,
  notifyWorkspaceRestaurantChanged,
} from "@/lib/supabase/workspace-persistence";
import { normalizeHex } from "@/lib/theme/color-utils";
import { defaultWeeklyHours } from "@/lib/constants/restaurant-profile";

export type CreateWorkspaceRestaurantInput = {
  name: string;
  slugOverride?: string;
  street?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  phone?: string;
  weeklyHours?: Record<Weekday, DayHours>;
  accentHex?: string;
};

export type CreateWorkspaceRestaurantResult =
  | { ok: true; restaurantId: string; slug: string }
  | { ok: false; error: string };

async function pickUniqueRestaurantSlug(
  baseSlug: string,
): Promise<string | null> {
  const sb = createSupabaseBrowserClient();
  let candidate = baseSlug;
  let n = 2;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (isReservedRestaurantSlug(candidate)) {
      candidate = `${baseSlug}-${n}`;
      n += 1;
      continue;
    }
    const { available, error } = await isRestaurantSlugAvailable(sb, candidate);
    if (error) {
      console.warn("[gwada] pickUniqueRestaurantSlug", error);
      return null;
    }
    if (available) return candidate;
    candidate = `${baseSlug}-${n}`;
    n += 1;
  }
  return null;
}

/**
 * Creates a restaurant, owner membership, defaults, then optional
 * address / hours / accent — used by the setup wizard (and create drawer).
 */
export async function createWorkspaceRestaurant(
  input: CreateWorkspaceRestaurantInput,
): Promise<CreateWorkspaceRestaurantResult> {
  const trimmedName = input.name.trim();
  if (!trimmedName) {
    return { ok: false, error: "name_required" };
  }

  const sb = createSupabaseBrowserClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return { ok: false, error: "auth_required" };
  }

  const base =
    input.slugOverride?.trim()
      ? restaurantSlugFromName(input.slugOverride.trim())
      : restaurantSlugFromName(trimmedName);

  const slug = await pickUniqueRestaurantSlug(base);
  if (!slug) {
    return { ok: false, error: "slug_taken" };
  }

  const street = input.street?.trim() || "";
  const postalCode = input.postalCode?.trim() || "";
  const city = input.city?.trim() || "";
  const country = input.country?.trim() || "DE";
  const phone = input.phone?.trim() || "";
  const timezone = resolveRestaurantTimezone({
    country,
    street,
    city,
    postalCode,
  });

  const { data: inserted, error: insErr } = await sb
    .from("restaurants")
    .insert({
      name: trimmedName,
      slug,
      owner_profile_id: user.id,
      timezone,
      country,
      address_line1: street || null,
      postal_code: postalCode || null,
      city: city || null,
      phone: phone || null,
      is_published: true,
      brand_accent_hex: normalizeHex(input.accentHex ?? "") || null,
    })
    .select("id")
    .single();

  if (insErr || !inserted?.id) {
    console.warn(insErr);
    const msg = insErr?.message ?? "";
    if (msg.includes("duplicate key") || msg.includes("restaurants_slug")) {
      return { ok: false, error: "slug_taken" };
    }
    return { ok: false, error: msg || "create_failed" };
  }

  const restaurantId = inserted.id as string;

  const { error: empErr } = await sb.from("restaurant_employees").insert({
    restaurant_id: restaurantId,
    profile_id: user.id,
    role: "owner",
    is_active: true,
  });

  if (empErr) {
    console.warn(empErr);
    return { ok: false, error: "membership_failed" };
  }

  const { error: seedErr } = await seedRestaurantDefaultPositions(
    sb,
    restaurantId,
  );
  if (seedErr) {
    console.warn("seed_restaurant_default_positions", seedErr);
  }

  const { error: profErr } = await sb
    .from("profiles")
    .update({ active_restaurant_id: restaurantId })
    .eq("id", user.id);

  if (profErr) {
    console.warn(profErr);
    return { ok: false, error: "active_failed" };
  }

  const weeklyHours = input.weeklyHours ?? defaultWeeklyHours();
  const hoursResult = await replaceOpeningHoursForRestaurant(restaurantId, {
    weeklyHours,
    dateExceptions: [],
    kitchenHoursEnabled: false,
    kitchenWeeklyHours: defaultWeeklyHours(),
  });
  if (!hoursResult.ok) {
    console.warn("[gwada] setup wizard opening hours", hoursResult.error);
  }

  if (input.accentHex) {
    await updateRestaurantBrandAccentHex(restaurantId, input.accentHex);
  }

  void fetch(
    `/api/pos/fiskaly/provision?restaurantId=${encodeURIComponent(restaurantId)}`,
    { method: "POST" },
  ).catch((err) => {
    console.warn("fiskaly provision after restaurant create", err);
  });

  invalidateWorkspaceRestaurantCache();
  notifyWorkspaceRestaurantChanged();

  return { ok: true, restaurantId, slug };
}

export type CreateWorkspaceRestaurantErrorKey =
  | "errors.nameRequired"
  | "errors.authRequired"
  | "errors.membershipFailed"
  | "errors.activeFailed"
  | "errors.createFailed"
  | "slug_taken";

export function createWorkspaceRestaurantErrorKey(
  code: string,
): CreateWorkspaceRestaurantErrorKey {
  switch (code) {
    case "name_required":
      return "errors.nameRequired";
    case "auth_required":
      return "errors.authRequired";
    case "slug_taken":
      return "slug_taken";
    case "membership_failed":
      return "errors.membershipFailed";
    case "active_failed":
      return "errors.activeFailed";
    default:
      return "errors.createFailed";
  }
}
