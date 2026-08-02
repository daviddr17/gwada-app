import type {
  SuperadminRestaurantProfileDetail,
  SuperadminUserProfileDetail,
} from "@/lib/superadmin/superadmin-entity-profile-types";

export async function fetchSuperadminUserProfile(
  profileId: string,
): Promise<{ detail?: SuperadminUserProfileDetail; error?: string }> {
  const res = await fetch(
    `/api/superadmin/users/${encodeURIComponent(profileId)}`,
    { cache: "no-store" },
  );
  const body = (await res.json().catch(() => ({}))) as SuperadminUserProfileDetail & {
    error?: string;
  };
  if (!res.ok) {
    return { error: body.error ?? `http_${res.status}` };
  }
  return { detail: body };
}

export async function fetchSuperadminRestaurantProfile(
  restaurantId: string,
): Promise<{ detail?: SuperadminRestaurantProfileDetail; error?: string }> {
  const res = await fetch(
    `/api/superadmin/restaurants/${encodeURIComponent(restaurantId)}`,
    { cache: "no-store" },
  );
  const body = (await res
    .json()
    .catch(() => ({}))) as SuperadminRestaurantProfileDetail & {
    error?: string;
  };
  if (!res.ok) {
    return { error: body.error ?? `http_${res.status}` };
  }
  return { detail: body };
}
