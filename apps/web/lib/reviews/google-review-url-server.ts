import "server-only";

import { getGoogleBusinessAccessTokenForRestaurant } from "@/lib/integrations/google-business-access";

function googleLocationResourceName(locationName: string): string {
  const trimmed = locationName.trim();
  if (trimmed.startsWith("locations/")) return trimmed;
  const match = /locations\/[^/]+/.exec(trimmed);
  return match?.[0] ?? trimmed;
}

/**
 * Google-Bewertungs-URL aus verbundenen Google-Business-Metadaten
 * (`metadata.newReviewUri` bzw. Place-ID), wenn keine manuelle URL gesetzt ist.
 */
export async function resolveGoogleReviewUrlFromBusiness(
  restaurantId: string,
): Promise<string | null> {
  const auth = await getGoogleBusinessAccessTokenForRestaurant(restaurantId);
  if ("error" in auth) return null;

  const locationRaw = auth.config.location_name?.trim();
  if (!locationRaw) return null;

  const locationName = googleLocationResourceName(locationRaw);
  const readMask = encodeURIComponent("metadata");
  const url = `https://mybusinessbusinessinformation.googleapis.com/v1/${locationName}?readMask=${readMask}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${auth.accessToken}` },
    cache: "no-store",
  });

  const payload = (await res.json().catch(() => ({}))) as {
    metadata?: {
      newReviewUri?: string;
      placeId?: string;
    };
    error?: { message?: string };
  };

  if (!res.ok) {
    console.warn(
      "resolveGoogleReviewUrlFromBusiness",
      payload.error?.message ?? `google_metadata_${res.status}`,
    );
    return null;
  }

  const newReviewUri = payload.metadata?.newReviewUri?.trim();
  if (newReviewUri) return newReviewUri;

  const placeId = payload.metadata?.placeId?.trim();
  if (placeId) {
    return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`;
  }

  return null;
}
