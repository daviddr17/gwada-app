/** Diff: Keys, die neu hinzugekommen sind. */
export function diffAddedPermissionKeys(
  previous: readonly string[],
  next: readonly string[],
): string[] {
  const prev = new Set(previous);
  return [...new Set(next.filter((k) => !prev.has(k)))];
}

export async function notifyStaffPermissionsGrantedClient(params: {
  restaurantId: string;
  addedKeys: string[];
  positionId?: string;
  profileId?: string;
  positionName?: string | null;
}): Promise<void> {
  if (params.addedKeys.length === 0) return;
  try {
    await fetch("/api/staff/permissions-granted", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        restaurantId: params.restaurantId,
        addedKeys: params.addedKeys,
        positionId: params.positionId,
        profileId: params.profileId,
        positionName: params.positionName ?? null,
      }),
    });
  } catch (err) {
    console.warn(
      "[permissions-granted] notify failed",
      err instanceof Error ? err.message : err,
    );
  }
}
