/** Fan-out: persönliche Erinnerung nur an den Notiz-Eigentümer. */
export function filterPersonalReminderPushTargets(
  event: { payload: Record<string, unknown> | null },
  targets: { profileId: string; restaurantId: string }[],
): { profileId: string; restaurantId: string }[] {
  const targetProfileId = event.payload?.targetProfileId;
  if (typeof targetProfileId !== "string" || !targetProfileId) {
    return [];
  }
  return targets.filter((t) => t.profileId === targetProfileId);
}
