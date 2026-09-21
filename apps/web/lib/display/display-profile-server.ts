import "server-only";

import type { DisplayStaffProfilePayload } from "@/lib/display/display-profile-types";
import { signStaffAvatarUrl } from "@/lib/display/display-storage-urls";
import type { SupabaseClient } from "@supabase/supabase-js";

export type { DisplayStaffProfilePayload } from "@/lib/display/display-profile-types";

export async function loadDisplayStaffProfile(
  admin: SupabaseClient,
  params: { restaurantId: string; staffId: string },
): Promise<DisplayStaffProfilePayload | null> {
  const { data, error } = await admin
    .from("restaurant_staff")
    .select(
      `
      given_name,
      family_name,
      email,
      phone,
      birth_date,
      nationality,
      address_line1,
      address_line2,
      postal_code,
      city,
      country,
      avatar_storage_path,
      restaurant_position:restaurant_positions ( name ),
      position_tag:restaurant_staff_position_tags ( name )
    `,
    )
    .eq("id", params.staffId)
    .eq("restaurant_id", params.restaurantId)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as Record<string, unknown>;
  const posRaw = row.restaurant_position;
  const posOne = Array.isArray(posRaw) ? posRaw[0] : posRaw;
  const tagRaw = row.position_tag;
  const tagOne = Array.isArray(tagRaw) ? tagRaw[0] : tagRaw;

  const positionFromRole =
    posOne && typeof posOne === "object" && "name" in posOne
      ? String((posOne as { name: string }).name).trim()
      : "";
  const positionFromTag =
    tagOne && typeof tagOne === "object" && "name" in tagOne
      ? String((tagOne as { name: string }).name).trim()
      : "";

  return {
    given_name: String(row.given_name ?? ""),
    family_name: String(row.family_name ?? ""),
    email: (row.email as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    birth_date: (row.birth_date as string | null) ?? null,
    nationality: (row.nationality as string | null) ?? null,
    address_line1: (row.address_line1 as string | null) ?? null,
    address_line2: (row.address_line2 as string | null) ?? null,
    postal_code: (row.postal_code as string | null) ?? null,
    city: (row.city as string | null) ?? null,
    country: (row.country as string | null) ?? null,
    position_name: positionFromRole || positionFromTag || null,
    avatar_url: await signStaffAvatarUrl(
      admin,
      (row.avatar_storage_path as string | null) ?? null,
    ),
  };
}
