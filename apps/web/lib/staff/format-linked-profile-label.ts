export type LinkedProfileFields = {
  given_name?: string | null;
  family_name?: string | null;
  display_name?: string | null;
};

export function formatLinkedProfileLabel(
  profile: LinkedProfileFields | null | undefined,
): string {
  if (!profile) return "—";
  const gn = profile.given_name?.trim() ?? "";
  const fn = profile.family_name?.trim() ?? "";
  if (gn || fn) return [gn, fn].filter(Boolean).join(" ");
  const d = profile.display_name?.trim();
  return d || "—";
}
