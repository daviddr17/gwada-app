import "server-only";

import { rewriteAdminSignedStorageUrl } from "@/lib/auth/rewrite-admin-auth-action-link";
import {
  resolveUserProfileImageSignedUrl,
} from "@/lib/profile/user-profile-image";
import {
  resolveRestaurantProfileImageSignedUrl,
} from "@/lib/restaurant/restaurant-profile-image";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import type {
  SuperadminRestaurantProfileDetail,
  SuperadminRestaurantTeamMember,
  SuperadminUserMembership,
  SuperadminUserProfileDetail,
} from "@/lib/superadmin/superadmin-entity-profile-types";
import type { EmployeeRole } from "@/lib/types/employee-role";

function isOnlineFromLastSeen(lastSeenAt: string | null): boolean {
  if (!lastSeenAt) return false;
  const ts = Date.parse(lastSeenAt);
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts <= 5 * 60 * 1000;
}

function personDisplayName(parts: {
  given_name?: string | null;
  family_name?: string | null;
  display_name?: string | null;
  email?: string | null;
}): string {
  const gn = parts.given_name?.trim() ?? "";
  const fn = parts.family_name?.trim() ?? "";
  if (gn || fn) return [gn, fn].filter(Boolean).join(" ");
  return parts.display_name?.trim() || parts.email?.trim() || "—";
}

async function signUserImage(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  path: string | null,
): Promise<string | null> {
  const url = await resolveUserProfileImageSignedUrl(admin, path, 3600);
  return url ? rewriteAdminSignedStorageUrl(url) : null;
}

async function signRestaurantImage(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  path: string | null,
): Promise<string | null> {
  return resolveRestaurantProfileImageSignedUrl(admin, path, 3600);
}

export async function loadSuperadminUserProfile(
  profileId: string,
): Promise<
  | { ok: true; detail: SuperadminUserProfileDetail }
  | { ok: false; error: string; status: number }
> {
  if (!isUuidRestaurantId(profileId)) {
    return { ok: false, error: "invalid_profile", status: 400 };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, error: "admin_unavailable", status: 503 };
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select(
      "id, given_name, family_name, display_name, nickname, phone, locale, birth_date, address_line1, address_postal_code, address_city, address_country, avatar_storage_path, cover_storage_path, last_seen_at, created_at, updated_at",
    )
    .eq("id", profileId)
    .maybeSingle();

  if (profileError) {
    return { ok: false, error: profileError.message, status: 500 };
  }
  if (!profile) {
    return { ok: false, error: "not_found", status: 404 };
  }

  const [{ data: authUser }, { data: saRow }, { data: membershipRows }] =
    await Promise.all([
      admin.auth.admin.getUserById(profileId),
      admin
        .from("platform_superadmins")
        .select("profile_id")
        .eq("profile_id", profileId)
        .maybeSingle(),
      admin
        .from("restaurant_employees")
        .select(
          "role, is_active, hired_at, restaurants(id, name, slug)",
        )
        .eq("profile_id", profileId)
        .order("hired_at", { ascending: false }),
    ]);

  const memberships: SuperadminUserMembership[] = [];
  for (const row of membershipRows ?? []) {
    const r = row as {
      role: string;
      is_active: boolean;
      hired_at: string | null;
      restaurants:
        | { id: string; name: string; slug: string }
        | { id: string; name: string; slug: string }[]
        | null;
    };
    const restaurant = Array.isArray(r.restaurants)
      ? r.restaurants[0]
      : r.restaurants;
    if (!restaurant) continue;
    memberships.push({
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      restaurantSlug: restaurant.slug,
      role: r.role as EmployeeRole,
      isActive: Boolean(r.is_active),
      hiredAt: r.hired_at,
    });
  }

  const lastSeenAt =
    typeof profile.last_seen_at === "string" ? profile.last_seen_at : null;

  const [avatarUrl, coverUrl] = await Promise.all([
    signUserImage(
      admin,
      typeof profile.avatar_storage_path === "string"
        ? profile.avatar_storage_path
        : null,
    ),
    signUserImage(
      admin,
      typeof profile.cover_storage_path === "string"
        ? profile.cover_storage_path
        : null,
    ),
  ]);

  return {
    ok: true,
    detail: {
      profileId,
      email: authUser.user?.email ?? null,
      givenName:
        typeof profile.given_name === "string" ? profile.given_name : null,
      familyName:
        typeof profile.family_name === "string" ? profile.family_name : null,
      displayName:
        typeof profile.display_name === "string" ? profile.display_name : null,
      nickname:
        typeof profile.nickname === "string" ? profile.nickname : null,
      phone: typeof profile.phone === "string" ? profile.phone : null,
      locale: typeof profile.locale === "string" ? profile.locale : null,
      birthDate:
        typeof profile.birth_date === "string" ? profile.birth_date : null,
      addressLine1:
        typeof profile.address_line1 === "string"
          ? profile.address_line1
          : null,
      addressPostalCode:
        typeof profile.address_postal_code === "string"
          ? profile.address_postal_code
          : null,
      addressCity:
        typeof profile.address_city === "string" ? profile.address_city : null,
      addressCountry:
        typeof profile.address_country === "string"
          ? profile.address_country
          : null,
      createdAt:
        typeof profile.created_at === "string" ? profile.created_at : null,
      updatedAt:
        typeof profile.updated_at === "string" ? profile.updated_at : null,
      lastSignInAt: authUser.user?.last_sign_in_at ?? null,
      lastSeenAt,
      isOnline: isOnlineFromLastSeen(lastSeenAt),
      isPlatformSuperadmin: Boolean(saRow?.profile_id),
      avatarUrl,
      coverUrl,
      memberships,
    },
  };
}

export async function loadSuperadminRestaurantProfile(
  restaurantId: string,
): Promise<
  | { ok: true; detail: SuperadminRestaurantProfileDetail }
  | { ok: false; error: string; status: number }
> {
  if (!isUuidRestaurantId(restaurantId)) {
    return { ok: false, error: "invalid_restaurant", status: 400 };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, error: "admin_unavailable", status: 503 };
  }

  const { data: restaurant, error: restaurantError } = await admin
    .from("restaurants")
    .select(
      "id, slug, name, description, email, phone, website, social_handle, timezone, is_published, brand_accent_hex, address_line1, address_line2, postal_code, city, country, vat_number, legal_name, avatar_storage_path, cover_storage_path, owner_profile_id, created_at, updated_at",
    )
    .eq("id", restaurantId)
    .maybeSingle();

  if (restaurantError) {
    return { ok: false, error: restaurantError.message, status: 500 };
  }
  if (!restaurant) {
    return { ok: false, error: "not_found", status: 404 };
  }

  const ownerId =
    typeof restaurant.owner_profile_id === "string"
      ? restaurant.owner_profile_id
      : null;

  const [
    { data: ownerProfile },
    ownerAuth,
    { data: subRow },
    { data: posAddon },
    { data: teamRows },
    { count: employeeCount },
  ] = await Promise.all([
    ownerId
      ? admin
          .from("profiles")
          .select("given_name, family_name, display_name")
          .eq("id", ownerId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    ownerId
      ? admin.auth.admin.getUserById(ownerId)
      : Promise.resolve({ data: { user: null } }),
    admin
      .from("restaurant_subscriptions")
      .select("plan_id, status, source, interval")
      .eq("restaurant_id", restaurantId)
      .maybeSingle(),
    admin
      .from("restaurant_subscription_addons")
      .select("addon_id")
      .eq("restaurant_id", restaurantId)
      .eq("addon_id", "pos")
      .in("status", ["active", "legacy", "past_due"])
      .maybeSingle(),
    admin
      .from("restaurant_employees")
      .select(
        "profile_id, role, is_active, profiles(given_name, family_name, display_name)",
      )
      .eq("restaurant_id", restaurantId)
      .eq("is_active", true)
      .order("role", { ascending: true })
      .limit(24),
    admin
      .from("restaurant_employees")
      .select("profile_id", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId)
      .eq("is_active", true),
  ]);

  const team: SuperadminRestaurantTeamMember[] = [];
  for (const row of teamRows ?? []) {
    const r = row as {
      profile_id: string;
      role: string;
      is_active: boolean;
      profiles:
        | {
            given_name: string | null;
            family_name: string | null;
            display_name: string | null;
          }
        | {
            given_name: string | null;
            family_name: string | null;
            display_name: string | null;
          }[]
        | null;
    };
    const profile = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    team.push({
      profileId: r.profile_id,
      displayName: personDisplayName({
        given_name: profile?.given_name,
        family_name: profile?.family_name,
        display_name: profile?.display_name,
      }),
      email: null,
      role: r.role as EmployeeRole,
      isActive: Boolean(r.is_active),
    });
  }

  const [avatarUrl, coverUrl] = await Promise.all([
    signRestaurantImage(
      admin,
      typeof restaurant.avatar_storage_path === "string"
        ? restaurant.avatar_storage_path
        : null,
    ),
    signRestaurantImage(
      admin,
      typeof restaurant.cover_storage_path === "string"
        ? restaurant.cover_storage_path
        : null,
    ),
  ]);

  return {
    ok: true,
    detail: {
      id: restaurant.id as string,
      slug: (restaurant.slug as string) ?? "",
      name: (restaurant.name as string) ?? "",
      description:
        typeof restaurant.description === "string"
          ? restaurant.description
          : null,
      email: typeof restaurant.email === "string" ? restaurant.email : null,
      phone: typeof restaurant.phone === "string" ? restaurant.phone : null,
      website:
        typeof restaurant.website === "string" ? restaurant.website : null,
      socialHandle:
        typeof restaurant.social_handle === "string"
          ? restaurant.social_handle
          : null,
      timezone:
        typeof restaurant.timezone === "string" && restaurant.timezone.trim()
          ? restaurant.timezone
          : "Europe/Berlin",
      isPublished: Boolean(restaurant.is_published),
      brandAccentHex:
        typeof restaurant.brand_accent_hex === "string"
          ? restaurant.brand_accent_hex
          : null,
      addressLine1:
        typeof restaurant.address_line1 === "string"
          ? restaurant.address_line1
          : null,
      addressLine2:
        typeof restaurant.address_line2 === "string"
          ? restaurant.address_line2
          : null,
      postalCode:
        typeof restaurant.postal_code === "string"
          ? restaurant.postal_code
          : null,
      city: typeof restaurant.city === "string" ? restaurant.city : null,
      country:
        typeof restaurant.country === "string" ? restaurant.country : null,
      vatNumber:
        typeof restaurant.vat_number === "string"
          ? restaurant.vat_number
          : null,
      legalName:
        typeof restaurant.legal_name === "string"
          ? restaurant.legal_name
          : null,
      createdAt:
        typeof restaurant.created_at === "string"
          ? restaurant.created_at
          : null,
      updatedAt:
        typeof restaurant.updated_at === "string"
          ? restaurant.updated_at
          : null,
      ownerProfileId: ownerId,
      ownerEmail: ownerAuth.data.user?.email ?? null,
      ownerDisplayName: ownerProfile
        ? personDisplayName(ownerProfile)
        : null,
      avatarUrl,
      coverUrl,
      planId:
        typeof subRow?.plan_id === "string" ? subRow.plan_id : "free",
      planStatus:
        typeof subRow?.status === "string" ? subRow.status : "active",
      planSource:
        typeof subRow?.source === "string" ? subRow.source : "manual",
      planInterval:
        typeof subRow?.interval === "string" ? subRow.interval : "month",
      hasPosAddon: Boolean(posAddon?.addon_id),
      team,
      employeeCount: employeeCount ?? team.length,
    },
  };
}
