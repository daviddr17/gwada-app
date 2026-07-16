import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReservationLogDetails } from "@/lib/types/reservation-log";

export type DisplayReservationActor = {
  profileId: string | null;
  givenName: string;
  familyName: string;
};

/** PIN-Mitarbeiter der Display-Session — für created_by + Protokoll. */
export async function resolveDisplayReservationActor(
  admin: SupabaseClient,
  staffId: string,
): Promise<DisplayReservationActor> {
  const { data } = await admin
    .from("restaurant_staff")
    .select("profile_id, given_name, family_name")
    .eq("id", staffId)
    .maybeSingle();

  return {
    profileId: (data?.profile_id as string | null) ?? null,
    givenName: ((data?.given_name as string) ?? "").trim(),
    familyName: ((data?.family_name as string) ?? "").trim(),
  };
}

export function displayReservationLogActorFields(
  actor: DisplayReservationActor,
): Pick<
  ReservationLogDetails,
  "actorSource" | "actorGivenName" | "actorFamilyName"
> {
  return {
    actorSource: "display",
    actorGivenName: actor.givenName,
    actorFamilyName: actor.familyName,
  };
}

/** Klarname für Protokolle / Nachrichten-Absender (z. B. „Max · Display“). */
export function formatDisplayActorLabel(actor: DisplayReservationActor): string {
  const name = [actor.givenName, actor.familyName].filter(Boolean).join(" ");
  return name ? `${name} · Display` : "Display";
}
