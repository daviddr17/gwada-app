import "server-only";

import { signRestaurantAvatarUrl } from "@/lib/display/display-storage-urls";
import {
  oauthConfigFromJson,
  type GoogleBusinessIntegrationConfig,
  type MetaOAuthIntegrationConfig,
} from "@/lib/integrations/oauth-integration-types";
import { loadOpeningHoursAdmin } from "@/lib/reservations/public-reservation-server";
import { averageRating } from "@/lib/reviews/review-stats";
import {
  normalizeRestaurantSlugInput,
} from "@/lib/restaurant/restaurant-slug";
import { isReservedRestaurantSlug } from "@/lib/restaurant/reserved-restaurant-slugs";
import { DEFAULT_ACCENT_HEX } from "@/lib/theme/constants";
import { normalizeHex } from "@/lib/theme/color-utils";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { DayHours, Weekday } from "@/lib/types/restaurant";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PublicRestaurantSocialLink = {
  kind: "facebook" | "instagram" | "google" | "phone" | "email";
  label: string;
  href: string;
};

export type PublicRestaurantProfile = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  accentHex: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  addressLine1: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  socialLinks: PublicRestaurantSocialLink[];
  weeklyHours: Record<Weekday, DayHours>;
  reviewSummary: { count: number; average: number | null } | null;
  modules: {
    reservation: boolean;
    menu: boolean;
    reviews: boolean;
  };
};

export type PublicRestaurantPageData = {
  profile: PublicRestaurantProfile;
};

function adminOrError(): SupabaseClient | { error: string; status: number } {
  const admin = createSupabaseAdminClient();
  if (!admin) return { error: "server_misconfigured", status: 503 };
  return admin;
}

async function loadSocialLinks(
  admin: SupabaseClient,
  restaurantId: string,
  phone: string | null,
  email: string | null,
): Promise<PublicRestaurantSocialLink[]> {
  const links: PublicRestaurantSocialLink[] = [];

  const [fbRes, igRes, googleRes, settingsRes] = await Promise.all([
    admin
      .from("restaurant_integrations")
      .select("status, config")
      .eq("restaurant_id", restaurantId)
      .eq("integration_key", "facebook")
      .maybeSingle(),
    admin
      .from("restaurant_integrations")
      .select("status, config")
      .eq("restaurant_id", restaurantId)
      .eq("integration_key", "instagram")
      .maybeSingle(),
    admin
      .from("restaurant_integrations")
      .select("status, config")
      .eq("restaurant_id", restaurantId)
      .eq("integration_key", "google_business")
      .maybeSingle(),
    admin
      .from("restaurant_reservation_settings")
      .select("review_google_url")
      .eq("restaurant_id", restaurantId)
      .maybeSingle(),
  ]);

  const phoneTrimmed = phone?.trim();
  if (phoneTrimmed) {
    const tel = phoneTrimmed.replace(/\s+/g, "");
    links.push({
      kind: "phone",
      label: phoneTrimmed,
      href: tel.startsWith("+") ? `tel:${tel}` : `tel:${tel}`,
    });
  }

  const emailTrimmed = email?.trim();
  if (emailTrimmed) {
    links.push({
      kind: "email",
      label: emailTrimmed,
      href: `mailto:${emailTrimmed}`,
    });
  }

  const fbRow = fbRes.data as { status?: string; config?: unknown } | null;
  if (fbRow?.status === "working") {
    const cfg = oauthConfigFromJson<MetaOAuthIntegrationConfig>(fbRow.config);
    const pageId = cfg.page_id?.trim();
    if (pageId) {
      links.push({
        kind: "facebook",
        label: cfg.page_name?.trim() || "Facebook",
        href: `https://www.facebook.com/${pageId}`,
      });
    }
  }

  const igRow = igRes.data as { status?: string; config?: unknown } | null;
  if (igRow?.status === "working") {
    const cfg = oauthConfigFromJson<MetaOAuthIntegrationConfig>(igRow.config);
    const username = cfg.instagram_username?.trim();
    if (username) {
      links.push({
        kind: "instagram",
        label: `@${username.replace(/^@/, "")}`,
        href: `https://instagram.com/${username.replace(/^@/, "")}`,
      });
    }
  }

  const googleReviewRaw = settingsRes.data?.review_google_url;
  const googleReviewUrl =
    typeof googleReviewRaw === "string" && googleReviewRaw.trim()
      ? googleReviewRaw.trim()
      : null;

  if (googleReviewUrl) {
    links.push({
      kind: "google",
      label: "Google",
      href: googleReviewUrl,
    });
  } else {
    const googleRow = googleRes.data as { status?: string; config?: unknown } | null;
    if (googleRow?.status === "working") {
      const cfg = oauthConfigFromJson<GoogleBusinessIntegrationConfig>(
        googleRow.config,
      );
      const title = cfg.location_title?.trim();
      if (title) {
        links.push({
          kind: "google",
          label: title,
          href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(title)}`,
        });
      }
    }
  }

  return links;
}

export async function fetchPublicRestaurantProfile(
  slugInput: string,
): Promise<
  | { data: PublicRestaurantProfile; error: null }
  | { data: null; error: string; status: number }
> {
  const admin = adminOrError();
  if ("error" in admin) {
    return { data: null, error: admin.error, status: admin.status };
  }

  const slug = normalizeRestaurantSlugInput(slugInput);
  if (!slug || isReservedRestaurantSlug(slug)) {
    return { data: null, error: "not_found", status: 404 };
  }

  const { data: row, error } = await admin
    .from("restaurants")
    .select(
      "id, name, slug, description, brand_accent_hex, is_published, address_line1, postal_code, city, country, phone, email, avatar_storage_path, cover_storage_path",
    )
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    return { data: null, error: "db_error", status: 500 };
  }
  if (!row?.id || !row.is_published) {
    return { data: null, error: "not_found", status: 404 };
  }

  const restaurantId = row.id as string;
  const accentHex =
    normalizeHex(String(row.brand_accent_hex ?? "")) ?? DEFAULT_ACCENT_HEX;

  const [avatarUrl, coverUrl, socialLinks, { weeklyHours }, menuCountRes, reviewRowsRes] =
    await Promise.all([
      signRestaurantAvatarUrl(admin, row.avatar_storage_path as string | null),
      signRestaurantAvatarUrl(admin, row.cover_storage_path as string | null),
      loadSocialLinks(
        admin,
        restaurantId,
        typeof row.phone === "string" ? row.phone : null,
        typeof row.email === "string" ? row.email : null,
      ),
      loadOpeningHoursAdmin(admin, restaurantId),
      admin
        .from("menu_categories")
        .select("id", { count: "exact", head: true })
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true),
      admin
        .from("gwada_reviews")
        .select("rating")
        .eq("restaurant_id", restaurantId)
        .limit(100),
    ]);

  const menuCount = menuCountRes.count ?? 0;
  const reviewRatings = (reviewRowsRes.data ?? []).map((r) =>
    Number((r as { rating: number }).rating),
  );
  const reviewSummary =
    reviewRatings.length > 0
      ? {
          count: reviewRatings.length,
          average: averageRating(
            reviewRatings.map((rating) => ({ rating })),
          ),
        }
      : null;

  return {
    data: {
      id: restaurantId,
      slug: row.slug as string,
      name: row.name as string,
      description:
        typeof row.description === "string" && row.description.trim()
          ? row.description.trim()
          : null,
      accentHex,
      avatarUrl,
      coverUrl,
      addressLine1:
        typeof row.address_line1 === "string" && row.address_line1.trim()
          ? row.address_line1.trim()
          : null,
      postalCode:
        typeof row.postal_code === "string" && row.postal_code.trim()
          ? row.postal_code.trim()
          : null,
      city:
        typeof row.city === "string" && row.city.trim() ? row.city.trim() : null,
      country:
        typeof row.country === "string" && row.country.trim()
          ? row.country.trim()
          : null,
      phone:
        typeof row.phone === "string" && row.phone.trim() ? row.phone.trim() : null,
      email:
        typeof row.email === "string" && row.email.trim() ? row.email.trim() : null,
      socialLinks,
      weeklyHours,
      reviewSummary,
      modules: {
        reservation: true,
        menu: menuCount > 0,
        reviews: true,
      },
    },
    error: null,
  };
}

export async function fetchPublicRestaurantPageData(
  slugInput: string,
): Promise<
  | { data: PublicRestaurantPageData; error: null }
  | { data: null; error: string; status: number }
> {
  const profileRes = await fetchPublicRestaurantProfile(slugInput);
  if (!profileRes.data) {
    return {
      data: null,
      error: profileRes.error,
      status: profileRes.status,
    };
  }

  return {
    data: { profile: profileRes.data },
    error: null,
  };
}
