import "server-only";

import { META_GRAPH_VERSION } from "@/lib/constants/integration-oauth-scopes";
import { oauthConfigFromJson } from "@/lib/integrations/oauth-integration-types";
import type { MetaOAuthIntegrationConfig } from "@/lib/integrations/oauth-integration-types";
import { publicReservationBookingUrlForPlatform } from "@/lib/reservations/public-reservation-url";
import { fetchRestaurantOAuthIntegrationAdmin } from "@/lib/supabase/restaurant-oauth-integration-db";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

async function loadRestaurantSlug(
  restaurantId: string,
): Promise<{ slug: string } | { error: string }> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { error: "server_misconfigured" };

  const { data, error } = await admin
    .from("restaurants")
    .select("slug, is_published")
    .eq("id", restaurantId)
    .maybeSingle();

  if (error || !data) return { error: "restaurant_not_found" };

  const slug = (data as { slug?: string | null }).slug?.trim();
  if (!slug) return { error: "restaurant_slug_missing" };
  if (!(data as { is_published?: boolean }).is_published) {
    return { error: "restaurant_not_published" };
  }

  return { slug };
}

export async function syncFacebookReservationCta(
  restaurantId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const row = await fetchRestaurantOAuthIntegrationAdmin(
    restaurantId,
    "facebook",
    (raw) => oauthConfigFromJson<MetaOAuthIntegrationConfig>(raw),
  );
  if (!row || row.status !== "working") {
    return { ok: false, error: "facebook_not_connected" };
  }

  const pageId = row.config.page_id?.trim();
  const token = row.config.page_access_token?.trim();
  if (!pageId || !token) return { ok: false, error: "facebook_token_missing" };

  const slugResult = await loadRestaurantSlug(restaurantId);
  if ("error" in slugResult) return { ok: false, error: slugResult.error };

  const bookingUrl = publicReservationBookingUrlForPlatform(
    slugResult.slug,
    "facebook",
  );

  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${pageId}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      call_to_action: {
        type: "BOOK_TRAVEL",
        value: {
          link: bookingUrl,
          link_title: "Reservieren",
        },
      },
      access_token: token,
    }),
    cache: "no-store",
  });

  const payload = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    error?: { message?: string };
  };

  if (!res.ok || payload.error) {
    return {
      ok: false,
      error: payload.error?.message ?? `facebook_cta_${res.status}`,
    };
  }

  return { ok: true };
}

export async function syncInstagramReservationCta(
  restaurantId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const row = await fetchRestaurantOAuthIntegrationAdmin(
    restaurantId,
    "instagram",
    (raw) => oauthConfigFromJson<MetaOAuthIntegrationConfig>(raw),
  );
  if (!row || row.status !== "working") {
    return { ok: false, error: "instagram_not_connected" };
  }

  const igUserId = row.config.instagram_business_account_id?.trim();
  const token = row.config.page_access_token?.trim();
  if (!igUserId || !token) {
    return { ok: false, error: "instagram_account_missing" };
  }

  const slugResult = await loadRestaurantSlug(restaurantId);
  if ("error" in slugResult) return { ok: false, error: slugResult.error };

  const bookingUrl = publicReservationBookingUrlForPlatform(
    slugResult.slug,
    "instagram",
  );

  // Instagram-Aktionsbutton: über verbundene Facebook-Seite (Meta Business Extension Pfad).
  const pageId = row.config.page_id?.trim();
  if (pageId) {
    const fbeUrl = `https://graph.facebook.com/${META_GRAPH_VERSION}/fbe_business`;
    const fbeRes = await fetch(fbeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fbe_external_business_id: restaurantId,
        business_config: JSON.stringify({
          business: { name: row.config.page_name ?? "Restaurant" },
          ig_cta: {
            enabled: true,
            cta_button_text: "Reservieren",
            cta_button_url: bookingUrl,
          },
        }),
        access_token: token,
      }),
      cache: "no-store",
    });
    const fbePayload = (await fbeRes.json().catch(() => ({}))) as {
      error?: { message?: string };
    };
    if (fbeRes.ok && !fbePayload.error) {
      return { ok: true };
    }
  }

  // Fallback: Profil-Link-Feld (Bio-Link) — sichtbarer Hinweis in der App.
  const profileUrl = `https://graph.facebook.com/${META_GRAPH_VERSION}/${igUserId}`;
  const res = await fetch(profileUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      website: bookingUrl,
      access_token: token,
    }),
    cache: "no-store",
  });

  const payload = (await res.json().catch(() => ({}))) as {
    error?: { message?: string };
  };

  if (!res.ok || payload.error) {
    return {
      ok: false,
      error: payload.error?.message ?? `instagram_cta_${res.status}`,
    };
  }

  return { ok: true };
}
