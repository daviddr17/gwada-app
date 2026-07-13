import "server-only";

import { getGoogleBusinessAccessTokenForRestaurant } from "@/lib/integrations/google-business-access";
import { publicReservationBookingUrlForPlatform } from "@/lib/reservations/public-reservation-url";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function googleLocationId(locationName: string): string | null {
  const trimmed = locationName.trim();
  const match = /locations\/([^/]+)/.exec(trimmed);
  return match?.[1] ?? null;
}

type PlaceActionLink = {
  name?: string;
  uri?: string;
  placeActionType?: string;
  isPreferred?: boolean;
};

export async function syncGoogleBusinessReservationLink(
  restaurantId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await getGoogleBusinessAccessTokenForRestaurant(restaurantId);
  if ("error" in auth) {
    return { ok: false, error: auth.error };
  }

  const locationRaw = auth.config.location_name?.trim();
  if (!locationRaw) {
    return { ok: false, error: "google_location_missing" };
  }

  const locationId = googleLocationId(locationRaw);
  if (!locationId) {
    return { ok: false, error: "google_location_missing" };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "server_misconfigured" };

  const { data: restaurant, error: restaurantError } = await admin
    .from("restaurants")
    .select("slug, is_published")
    .eq("id", restaurantId)
    .maybeSingle();

  if (restaurantError || !restaurant) {
    return { ok: false, error: "restaurant_not_found" };
  }

  const slug = (restaurant as { slug?: string | null }).slug?.trim();
  if (!slug) {
    return { ok: false, error: "restaurant_slug_missing" };
  }

  if (!(restaurant as { is_published?: boolean }).is_published) {
    return { ok: false, error: "restaurant_not_published" };
  }

  const bookingUrl = publicReservationBookingUrlForPlatform(slug, "google");
  const headers = { Authorization: `Bearer ${auth.accessToken}` };

  const listUrl = `https://mybusinessplaceactions.googleapis.com/v1/locations/${locationId}/placeActionLinks`;
  const listRes = await fetch(listUrl, { headers, cache: "no-store" });
  const listPayload = (await listRes.json().catch(() => ({}))) as {
    placeActionLinks?: PlaceActionLink[];
    error?: { message?: string };
  };

  if (!listRes.ok) {
    return {
      ok: false,
      error: listPayload.error?.message ?? `google_place_actions_${listRes.status}`,
    };
  }

  const existing = (listPayload.placeActionLinks ?? []).find(
    (link) => link.placeActionType === "DINING_RESERVATION",
  );

  if (existing?.name) {
    const patchUrl = `https://mybusinessplaceactions.googleapis.com/v1/${existing.name}?updateMask=uri,isPreferred`;
    const patchRes = await fetch(patchUrl, {
      method: "PATCH",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        uri: bookingUrl,
        isPreferred: true,
      }),
      cache: "no-store",
    });
    const patchPayload = (await patchRes.json().catch(() => ({}))) as {
      error?: { message?: string };
    };
    if (!patchRes.ok) {
      return {
        ok: false,
        error: patchPayload.error?.message ?? `google_place_actions_${patchRes.status}`,
      };
    }
    return { ok: true };
  }

  const createRes = await fetch(listUrl, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      uri: bookingUrl,
      placeActionType: "DINING_RESERVATION",
      isPreferred: true,
    }),
    cache: "no-store",
  });
  const createPayload = (await createRes.json().catch(() => ({}))) as {
    error?: { message?: string };
  };

  if (!createRes.ok) {
    return {
      ok: false,
      error: createPayload.error?.message ?? `google_place_actions_${createRes.status}`,
    };
  }

  return { ok: true };
}
