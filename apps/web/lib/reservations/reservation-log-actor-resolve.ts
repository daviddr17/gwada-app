import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ReservationLogDetails,
  RestaurantReservationLogEntry,
} from "@/lib/types/reservation-log";

type ActorNameParts = {
  actorGivenName: string;
  actorFamilyName: string;
};

function detailsHaveActorName(details: ReservationLogDetails): boolean {
  return Boolean(
    details.actorGivenName?.trim() || details.actorFamilyName?.trim(),
  );
}

function namePartsFromProfile(row: {
  given_name?: string | null;
  family_name?: string | null;
  display_name?: string | null;
}): ActorNameParts | null {
  const given = row.given_name?.trim() ?? "";
  const family = row.family_name?.trim() ?? "";
  if (given || family) {
    return { actorGivenName: given, actorFamilyName: family };
  }
  const display = row.display_name?.trim() ?? "";
  if (display) {
    return { actorGivenName: display, actorFamilyName: "" };
  }
  return null;
}

function namePartsFromStaff(row: {
  given_name?: string | null;
  family_name?: string | null;
}): ActorNameParts | null {
  const given = row.given_name?.trim() ?? "";
  const family = row.family_name?.trim() ?? "";
  if (!given && !family) return null;
  return { actorGivenName: given, actorFamilyName: family };
}

/**
 * Profil-/Mitarbeiternamen für einen Actor laden (Mitarbeiter vor Profil).
 * Für neue Log-Einträge und fehlende Snapshots.
 */
export async function resolveReservationLogActorNames(
  supabase: SupabaseClient,
  params: {
    restaurantId: string;
    actorUserId: string;
  },
): Promise<ActorNameParts | null> {
  const { data: staffRow } = await supabase
    .from("restaurant_staff")
    .select("given_name, family_name")
    .eq("restaurant_id", params.restaurantId)
    .eq("profile_id", params.actorUserId)
    .maybeSingle();

  const fromStaff = staffRow
    ? namePartsFromStaff(staffRow as { given_name?: string | null; family_name?: string | null })
    : null;
  if (fromStaff) return fromStaff;

  const { data: profile } = await supabase
    .from("profiles")
    .select("given_name, family_name, display_name")
    .eq("id", params.actorUserId)
    .maybeSingle();

  if (!profile) return null;
  return namePartsFromProfile(
    profile as {
      given_name?: string | null;
      family_name?: string | null;
      display_name?: string | null;
    },
  );
}

/**
 * Fehlende Actor-Namen in Protokollzeilen aus Mitarbeiter/Profil nachziehen.
 * Preferiert restaurant_staff (Mitarbeiter), dann profiles.
 */
export async function enrichReservationLogActorNames(
  supabase: SupabaseClient,
  entries: RestaurantReservationLogEntry[],
): Promise<RestaurantReservationLogEntry[]> {
  if (entries.length === 0) return entries;

  const missingIds = new Set<string>();
  for (const entry of entries) {
    if (!entry.actor_user_id) continue;
    if (entry.details.actorSource === "guest") continue;
    if (detailsHaveActorName(entry.details)) continue;
    missingIds.add(entry.actor_user_id);
  }

  if (missingIds.size === 0) return entries;

  const actorIds = [...missingIds];
  const restaurantIds = [...new Set(entries.map((entry) => entry.restaurant_id))];

  const [{ data: staffRows }, { data: profileRows }] = await Promise.all([
    supabase
      .from("restaurant_staff")
      .select("restaurant_id, profile_id, given_name, family_name")
      .in("restaurant_id", restaurantIds)
      .in("profile_id", actorIds),
    supabase
      .from("profiles")
      .select("id, given_name, family_name, display_name")
      .in("id", actorIds),
  ]);

  const staffByKey = new Map<string, ActorNameParts>();
  for (const row of staffRows ?? []) {
    const profileId = row.profile_id as string | null;
    if (!profileId) continue;
    const parts = namePartsFromStaff(
      row as { given_name?: string | null; family_name?: string | null },
    );
    if (!parts) continue;
    staffByKey.set(`${row.restaurant_id as string}:${profileId}`, parts);
  }

  const profileById = new Map<string, ActorNameParts>();
  for (const row of profileRows ?? []) {
    const parts = namePartsFromProfile(
      row as {
        given_name?: string | null;
        family_name?: string | null;
        display_name?: string | null;
      },
    );
    if (!parts) continue;
    profileById.set(row.id as string, parts);
  }

  return entries.map((entry) => {
    if (!entry.actor_user_id) return entry;
    if (entry.details.actorSource === "guest") return entry;
    if (detailsHaveActorName(entry.details)) return entry;

    const fromStaff = staffByKey.get(
      `${entry.restaurant_id}:${entry.actor_user_id}`,
    );
    const fromProfile = profileById.get(entry.actor_user_id);
    const parts = fromStaff ?? fromProfile;
    if (!parts) return entry;

    return {
      ...entry,
      details: {
        ...entry.details,
        actorGivenName: parts.actorGivenName,
        actorFamilyName: parts.actorFamilyName,
        actorSource: entry.details.actorSource ?? "staff",
      },
    };
  });
}
