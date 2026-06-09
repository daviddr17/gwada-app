import "server-only";

import { getGoogleBusinessAccessTokenForRestaurant } from "@/lib/integrations/google-business-access";
import type { IntegrationPlatformProfile } from "@/lib/integrations/platform-profile-types";

function googleLocationResourceName(locationName: string): string {
  const trimmed = locationName.trim();
  if (trimmed.startsWith("locations/")) return trimmed;
  const match = /locations\/[^/]+/.exec(trimmed);
  return match?.[0] ?? trimmed;
}

type GoogleAddress = {
  addressLines?: string[];
  locality?: string;
  postalCode?: string;
  administrativeArea?: string;
};

function formatGoogleAddress(address?: GoogleAddress | null): string {
  if (!address) return "";
  const parts = [
    ...(address.addressLines ?? []),
    [address.postalCode, address.locality].filter(Boolean).join(" "),
    address.administrativeArea,
  ].filter((part) => part && String(part).trim());
  return parts.join(", ");
}

function parseGoogleLocationPayload(payload: {
  title?: string;
  phoneNumbers?: { primaryPhone?: string };
  websiteUri?: string;
  profile?: { description?: string };
  storefrontAddress?: GoogleAddress;
}): IntegrationPlatformProfile {
  return {
    name: payload.title?.trim() ?? "",
    description: payload.profile?.description?.trim() ?? "",
    phone: payload.phoneNumbers?.primaryPhone?.trim() ?? "",
    website: payload.websiteUri?.trim() ?? "",
    address: formatGoogleAddress(payload.storefrontAddress),
  };
}

export async function fetchGoogleBusinessLocationProfile(
  restaurantId: string,
): Promise<
  { ok: true; profile: IntegrationPlatformProfile } | { ok: false; error: string }
> {
  const auth = await getGoogleBusinessAccessTokenForRestaurant(restaurantId);
  if ("error" in auth) {
    return { ok: false, error: auth.error };
  }

  const locationRaw = auth.config.location_name?.trim();
  if (!locationRaw) {
    return { ok: false, error: "google_location_missing" };
  }

  const locationName = googleLocationResourceName(locationRaw);
  const readMask = encodeURIComponent(
    "title,phoneNumbers,websiteUri,profile,storefrontAddress",
  );
  const url = `https://mybusinessbusinessinformation.googleapis.com/v1/${locationName}?readMask=${readMask}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${auth.accessToken}` },
    cache: "no-store",
  });

  const payload = (await res.json().catch(() => ({}))) as {
    title?: string;
    phoneNumbers?: { primaryPhone?: string };
    websiteUri?: string;
    profile?: { description?: string };
    storefrontAddress?: GoogleAddress;
    error?: { message?: string };
  };

  if (!res.ok) {
    return {
      ok: false,
      error: payload.error?.message ?? `google_profile_${res.status}`,
    };
  }

  return { ok: true, profile: parseGoogleLocationPayload(payload) };
}

export async function updateGoogleBusinessLocationProfile(
  restaurantId: string,
  patch: IntegrationPlatformProfile,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await getGoogleBusinessAccessTokenForRestaurant(restaurantId);
  if ("error" in auth) {
    return { ok: false, error: auth.error };
  }

  const locationRaw = auth.config.location_name?.trim();
  if (!locationRaw) {
    return { ok: false, error: "google_location_missing" };
  }

  const locationName = googleLocationResourceName(locationRaw);
  const body: Record<string, unknown> = {
    title: patch.name.trim(),
    profile: { description: patch.description.trim() },
    phoneNumbers: { primaryPhone: patch.phone.trim() },
    websiteUri: patch.website.trim(),
    storefrontAddress: {
      addressLines: patch.address.trim() ? [patch.address.trim()] : [],
    },
  };
  const updateMask = [
    "title",
    "profile.description",
    "phoneNumbers",
    "websiteUri",
    "storefrontAddress.addressLines",
  ];

  const url = `https://mybusinessbusinessinformation.googleapis.com/v1/${locationName}?updateMask=${encodeURIComponent(updateMask.join(","))}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const payload = (await res.json().catch(() => ({}))) as {
    error?: { message?: string };
  };

  if (!res.ok) {
    return {
      ok: false,
      error: payload.error?.message ?? `google_profile_${res.status}`,
    };
  }

  return { ok: true };
}
