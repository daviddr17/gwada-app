import type { SupabaseClient } from "@supabase/supabase-js";

export async function syncUserProfileNames(
  sb: SupabaseClient,
  params: { givenName: string; familyName: string },
): Promise<{ ok: boolean; error?: string }> {
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const givenName = params.givenName.trim();
  const familyName = params.familyName.trim();
  if (!givenName || !familyName) {
    return { ok: false, error: "missing_name" };
  }

  const displayName = [givenName, familyName].filter(Boolean).join(" ");
  const { error } = await sb
    .from("profiles")
    .update({
      given_name: givenName,
      family_name: familyName,
      display_name: displayName,
    })
    .eq("id", user.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
