import { RESTAURANT_STORAGE_KEY } from "@/lib/constants/restaurant-profile";
import { normalizeRestaurantSlugInput } from "@/lib/restaurant/restaurant-slug";
import { resolveRestaurantTimezone } from "@/lib/restaurant/restaurant-timezone";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import type { RestaurantProfile } from "@/lib/types/restaurant";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Relationaler Stammdaten-Pfad: `public.restaurants` (kein JSON-Cache). */
export const RESTAURANT_PROFILE_STORAGE_KEY = RESTAURANT_STORAGE_KEY;

export function restaurantRowFromProfile(
  profile: RestaurantProfile,
): Record<string, string | null> {
  return {
    name: profile.name.trim() || "Restaurant",
    slug: normalizeRestaurantSlugInput(profile.slug),
    address_line1: profile.street.trim() || null,
    postal_code: profile.postalCode.trim() || null,
    city: profile.city.trim() || null,
    country: profile.country.trim() || null,
    phone: profile.phone.trim() || null,
    website: profile.website.trim() || null,
    vat_number: profile.vatNumber.trim() || null,
    legal_name: profile.legalName.trim() || null,
    legal_representative: profile.legalRepresentative.trim() || null,
    legal_form: profile.legalForm.trim() || null,
    commercial_register: profile.commercialRegister.trim() || null,
    receipt_footer: profile.receiptFooter.trim() || null,
    social_handle: profile.socialHandle.trim() || null,
    timezone: resolveRestaurantTimezone({
      country: profile.country,
      street: profile.street,
      city: profile.city,
      postalCode: profile.postalCode,
    }),
  };
}

export type RestaurantProfileImagePaths = {
  avatarStoragePath: string | null;
  coverStoragePath: string | null;
};

/** Stammdaten aus `public.restaurants` (kein JSON-Cache). */
export async function fetchRestaurantStammdatenFromDb(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<Partial<RestaurantProfile> | null> {
  if (!isUuidRestaurantId(restaurantId)) return null;
  const { data, error } = await sb
    .from("restaurants")
    .select(
      "name, slug, address_line1, postal_code, city, country, phone, website, vat_number, legal_name, legal_representative, legal_form, commercial_register, receipt_footer, social_handle, avatar_storage_path, cover_storage_path",
    )
    .eq("id", restaurantId)
    .maybeSingle();
  if (error) {
    console.warn("[gwada] fetchRestaurantStammdatenFromDb", error.message);
    return null;
  }
  if (!data) return null;
  return {
    name: typeof data.name === "string" ? data.name : "Restaurant",
    slug: typeof data.slug === "string" ? data.slug : "",
    street: typeof data.address_line1 === "string" ? data.address_line1 : "",
    postalCode: typeof data.postal_code === "string" ? data.postal_code : "",
    city: typeof data.city === "string" ? data.city : "",
    country: typeof data.country === "string" ? data.country : "",
    phone: typeof data.phone === "string" ? data.phone : "",
    website: typeof data.website === "string" ? data.website : "",
    vatNumber: typeof data.vat_number === "string" ? data.vat_number : "",
    legalName: typeof data.legal_name === "string" ? data.legal_name : "",
    legalRepresentative:
      typeof data.legal_representative === "string"
        ? data.legal_representative
        : "",
    legalForm: typeof data.legal_form === "string" ? data.legal_form : "",
    commercialRegister:
      typeof data.commercial_register === "string"
        ? data.commercial_register
        : "",
    receiptFooter:
      typeof data.receipt_footer === "string" ? data.receipt_footer : "",
    socialHandle:
      typeof data.social_handle === "string" ? data.social_handle : "",
    avatarStoragePath:
      typeof data.avatar_storage_path === "string"
        ? data.avatar_storage_path
        : null,
    coverStoragePath:
      typeof data.cover_storage_path === "string"
        ? data.cover_storage_path
        : null,
  };
}

export async function fetchRestaurantProfileImages(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<RestaurantProfileImagePaths | null> {
  if (!isUuidRestaurantId(restaurantId)) return null;
  const { data, error } = await sb
    .from("restaurants")
    .select("avatar_storage_path, cover_storage_path")
    .eq("id", restaurantId)
    .maybeSingle();
  if (error) {
    console.warn("[gwada] fetchRestaurantProfileImages", error.message);
    return null;
  }
  return {
    avatarStoragePath:
      typeof data?.avatar_storage_path === "string"
        ? data.avatar_storage_path
        : null,
    coverStoragePath:
      typeof data?.cover_storage_path === "string"
        ? data.cover_storage_path
        : null,
  };
}

export async function fetchRestaurantSlug(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<string | null> {
  if (!isUuidRestaurantId(restaurantId)) return null;
  const { data, error } = await sb
    .from("restaurants")
    .select("slug")
    .eq("id", restaurantId)
    .maybeSingle();
  if (error) {
    console.warn("[gwada] fetchRestaurantSlug", error.message);
    return null;
  }
  return typeof data?.slug === "string" ? data.slug : null;
}

export async function isRestaurantSlugAvailable(
  sb: SupabaseClient,
  slug: string,
  excludeRestaurantId?: string | null,
): Promise<{ available: boolean; error: string | null }> {
  const normalized = normalizeRestaurantSlugInput(slug);
  const { data, error } = await sb.rpc("restaurant_slug_available", {
    p_slug: normalized,
    p_exclude_restaurant_id: excludeRestaurantId ?? null,
  });
  if (error) {
    console.warn("[gwada] restaurant_slug_available", error.message);
    return { available: false, error: error.message };
  }
  return { available: data === true, error: null };
}

function isSlugUniqueViolation(message: string | undefined): boolean {
  if (!message) return false;
  return (
    message.includes("duplicate key") ||
    message.includes("restaurants_slug_key") ||
    message.includes("unique constraint")
  );
}

/** Stammdaten aus dem App-Profil in `public.restaurants` spiegeln (Superadmin, Workspace-Liste). */
export async function syncRestaurantStammdatenToDb(
  sb: SupabaseClient,
  profile: RestaurantProfile,
): Promise<{ ok: boolean; error: string | null }> {
  if (!isUuidRestaurantId(profile.id)) {
    return { ok: true, error: null };
  }

  const slug = normalizeRestaurantSlugInput(profile.slug);
  const { available, error: availErr } = await isRestaurantSlugAvailable(
    sb,
    slug,
    profile.id,
  );
  if (availErr) {
    return { ok: false, error: availErr };
  }
  if (!available) {
    return { ok: false, error: null };
  }

  const { error } = await sb
    .from("restaurants")
    .update(restaurantRowFromProfile({ ...profile, slug }))
    .eq("id", profile.id);

  if (error) {
    if (isSlugUniqueViolation(error.message)) {
      return { ok: false, error: null };
    }
    return { ok: false, error: error.message };
  }

  return { ok: true, error: null };
}
