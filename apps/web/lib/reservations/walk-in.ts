export const WALK_IN_DEFAULT_LAST_NAME = "Laufkunde";

/** Optional display name → first/last for walk-in rows. */
export function walkInGuestNamesFromOptionalLabel(name: string | null | undefined): {
  guest_first_name: string;
  guest_last_name: string;
} {
  const trimmed = name?.trim() ?? "";
  if (!trimmed) {
    return { guest_first_name: "", guest_last_name: WALK_IN_DEFAULT_LAST_NAME };
  }
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return { guest_first_name: "", guest_last_name: parts[0]! };
  }
  return {
    guest_first_name: parts.slice(0, -1).join(" "),
    guest_last_name: parts[parts.length - 1]!,
  };
}
