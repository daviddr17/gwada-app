import "server-only";

import {
  type InsightsFetchRangeParams,
  type InsightsPeriodDays,
  resolveInsightsRange,
} from "@/lib/insights/insights-date-range";
import { fetchPlatformMessagingFlags } from "@/lib/supabase/platform-messaging-db";
import { fetchRestaurantOAuthIntegrationAdmin } from "@/lib/supabase/restaurant-oauth-integration-db";
import { fetchRestaurantTripadvisorConfigAdmin } from "@/lib/supabase/restaurant-tripadvisor-integration-db";
import { oauthConfigFromJson } from "@/lib/integrations/oauth-integration-types";
import type { MetaOAuthIntegrationConfig } from "@/lib/integrations/oauth-integration-types";
import { getGoogleBusinessAccessTokenForRestaurant } from "@/lib/integrations/google-business-access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

export type { InsightsPeriodDays } from "@/lib/insights/insights-date-range";

export type InsightsPlatformCard = {
  id: "google_business" | "facebook" | "instagram" | "tripadvisor";
  label: string;
  connected: boolean;
  enabled: boolean;
  insightsAvailable: boolean;
  hint: string;
};

export type InsightsOverviewPayload = {
  periodMode: "preset" | "custom";
  periodDays: InsightsPeriodDays | null;
  periodStartYmd: string;
  periodEndYmd: string;
  periodStart: string;
  periodEnd: string;
  gwada: {
    reservations: { count: number; guests: number };
    reviews: { count: number; avgRating: number | null };
    messages: { inbound: number };
  };
  platforms: InsightsPlatformCard[];
};

async function countReservations(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  restaurantId: string,
  rangeStartIso: string,
  rangeEndIso: string,
): Promise<{ count: number; guests: number }> {
  const { data, error } = await admin
    .from("reservations")
    .select("party_size")
    .eq("restaurant_id", restaurantId)
    .gte("starts_at", rangeStartIso)
    .lt("starts_at", rangeEndIso);

  if (error) {
    console.warn("insights reservations", error.message);
    return { count: 0, guests: 0 };
  }

  const rows = data ?? [];
  return {
    count: rows.length,
    guests: rows.reduce((sum, row) => sum + (row.party_size ?? 0), 0),
  };
}

async function countReviews(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  restaurantId: string,
  rangeStartIso: string,
  rangeEndIso: string,
): Promise<{ count: number; avgRating: number | null }> {
  const { data, error } = await admin
    .from("gwada_reviews")
    .select("rating")
    .eq("restaurant_id", restaurantId)
    .gte("created_at", rangeStartIso)
    .lt("created_at", rangeEndIso);

  if (error) {
    console.warn("insights reviews", error.message);
    return { count: 0, avgRating: null };
  }

  const rows = data ?? [];
  if (rows.length === 0) return { count: 0, avgRating: null };

  const sum = rows.reduce((acc, row) => acc + (row.rating ?? 0), 0);
  return { count: rows.length, avgRating: sum / rows.length };
}

async function countInboundMessages(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  restaurantId: string,
  rangeStartIso: string,
  rangeEndIso: string,
): Promise<number> {
  const { count, error } = await admin
    .from("contact_messages")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId)
    .eq("direction", "inbound")
    .gte("created_at", rangeStartIso)
    .lt("created_at", rangeEndIso);

  if (error) {
    console.warn("insights messages", error.message);
    return 0;
  }
  return count ?? 0;
}

async function platformCards(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<InsightsPlatformCard[]> {
  const flags = await fetchPlatformMessagingFlags(sb);

  const googleAuth = flags.googleBusinessEnabled
    ? await getGoogleBusinessAccessTokenForRestaurant(restaurantId)
    : null;
  const googleConnected = Boolean(
    googleAuth && !("error" in googleAuth) && googleAuth.config.location_name,
  );

  const facebookRow = flags.facebookEnabled
    ? await fetchRestaurantOAuthIntegrationAdmin(
        restaurantId,
        "facebook",
        (raw) => oauthConfigFromJson<MetaOAuthIntegrationConfig>(raw),
      )
    : null;
  const facebookConnected = facebookRow?.status === "working";

  const instagramRow = flags.instagramEnabled
    ? await fetchRestaurantOAuthIntegrationAdmin(
        restaurantId,
        "instagram",
        (raw) => oauthConfigFromJson<MetaOAuthIntegrationConfig>(raw),
      )
    : null;
  const instagramConnected = instagramRow?.status === "working";

  const tripadvisorRow = flags.tripadvisorEnabled
    ? await fetchRestaurantTripadvisorConfigAdmin(restaurantId)
    : null;
  const tripadvisorConnected = tripadvisorRow?.status === "working";

  return [
    {
      id: "google_business" as const,
      label: "Google Business",
      enabled: flags.googleBusinessEnabled,
      connected: googleConnected,
      insightsAvailable: googleConnected,
      hint: googleConnected
        ? "Profil-Insights über Google — demnächst direkt hier."
        : "Unter Einstellungen → Integrationen verbinden.",
    },
    {
      id: "facebook" as const,
      label: "Facebook",
      enabled: flags.facebookEnabled,
      connected: facebookConnected,
      insightsAvailable: false,
      hint: facebookConnected
        ? "Seiten-Insights folgen in einer späteren Version."
        : "Facebook-Seite unter Integrationen verbinden.",
    },
    {
      id: "instagram" as const,
      label: "Instagram",
      enabled: flags.instagramEnabled,
      connected: instagramConnected,
      insightsAvailable: false,
      hint: instagramConnected
        ? "Profil-Insights folgen in einer späteren Version."
        : "Instagram Business unter Integrationen verbinden.",
    },
    {
      id: "tripadvisor" as const,
      label: "TripAdvisor",
      enabled: flags.tripadvisorEnabled,
      connected: tripadvisorConnected,
      insightsAvailable: tripadvisorConnected,
      hint: tripadvisorConnected
        ? "Bewertungen und Galerie sind aktiv — Profil-Metriken folgen."
        : "TripAdvisor Location-ID unter Integrationen hinterlegen.",
    },
  ].filter((card) => card.enabled);
}

export async function fetchInsightsOverview(
  sb: SupabaseClient,
  restaurantId: string,
  rangeParams: InsightsFetchRangeParams,
): Promise<InsightsOverviewPayload | { error: string }> {
  const range = resolveInsightsRange(rangeParams);
  if (!range) return { error: "invalid_date_range" };

  const admin = createSupabaseAdminClient();
  if (!admin) return { error: "server_misconfigured" };

  const { rangeStartIso, rangeEndIso, periodStartYmd, periodEndYmd } = range;
  const periodDays =
    "periodDays" in rangeParams ? rangeParams.periodDays : null;

  const [reservations, reviews, messages, platforms] = await Promise.all([
    countReservations(admin, restaurantId, rangeStartIso, rangeEndIso),
    countReviews(admin, restaurantId, rangeStartIso, rangeEndIso),
    countInboundMessages(admin, restaurantId, rangeStartIso, rangeEndIso),
    platformCards(sb, restaurantId),
  ]);

  return {
    periodMode: periodDays != null ? "preset" : "custom",
    periodDays,
    periodStartYmd,
    periodEndYmd,
    periodStart: rangeStartIso,
    periodEnd: rangeEndIso,
    gwada: {
      reservations,
      reviews,
      messages: { inbound: messages },
    },
    platforms,
  };
}
