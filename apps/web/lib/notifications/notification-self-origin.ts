import "server-only";

/** Eigene Aktionen (Dashboard): nicht in Glocke/Push für den Akteur. */
export function isSelfOriginatedNotification(
  viewerProfileId: string,
  actorProfileId: string | null | undefined,
): boolean {
  if (!actorProfileId) return false;
  return actorProfileId === viewerProfileId;
}

export function actorProfileIdFromPayload(
  payload: Record<string, unknown> | null | undefined,
): string | null {
  if (!payload) return null;
  for (const key of ["actorProfileId", "createdByProfileId"] as const) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

export function shouldSkipNotificationForViewer(
  viewerProfileId: string,
  payload: Record<string, unknown> | null | undefined,
): boolean {
  return isSelfOriginatedNotification(
    viewerProfileId,
    actorProfileIdFromPayload(payload),
  );
}
