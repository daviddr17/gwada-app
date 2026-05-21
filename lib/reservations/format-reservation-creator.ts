export type ReservationCreatorProfile = {
  given_name?: string | null;
  family_name?: string | null;
  display_name?: string | null;
};

/** Anzeigename für „Erstellt von“ (App-Nutzer). */
export function formatReservationCreatorLabel(
  profile: ReservationCreatorProfile | null | undefined,
): string | null {
  if (!profile) return null;
  const given = profile.given_name?.trim() ?? "";
  const family = profile.family_name?.trim() ?? "";
  const combined = `${given} ${family}`.trim();
  if (combined) return combined;
  const display = profile.display_name?.trim();
  if (display) return display;
  return null;
}

/** null / kein Profil → Gast (externes Formular o. Ä.). */
export function reservationCreatorDisplayName(
  createdByProfileId: string | null | undefined,
  profile: ReservationCreatorProfile | null | undefined,
): string {
  if (!createdByProfileId) return "Gast";
  return formatReservationCreatorLabel(profile) ?? "App-Nutzer";
}
