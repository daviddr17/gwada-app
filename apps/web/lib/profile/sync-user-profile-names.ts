import type { SupabaseClient } from "@supabase/supabase-js";

export async function syncUserProfileNames(
  sb: SupabaseClient,
  params: { givenName: string; familyName: string },
): Promise<{ ok: boolean; error?: string }> {
  const givenName = params.givenName.trim();
  const familyName = params.familyName.trim();
  if (!givenName || !familyName) {
    return { ok: false, error: "missing_name" };
  }

  const { data, error } = await sb.rpc("sync_own_profile_names", {
    p_given_name: givenName,
    p_family_name: familyName,
  });

  if (!error) {
    const result = data as { ok?: boolean; error?: string } | null;
    if (result?.ok === false) {
      return { ok: false, error: result.error ?? "sync_failed" };
    }
    if (result?.ok === true) {
      return { ok: true };
    }
  }

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: error?.message ?? "unauthorized" };

  const displayName = [givenName, familyName].filter(Boolean).join(" ");
  const { error: updateError } = await sb
    .from("profiles")
    .update({
      given_name: givenName,
      family_name: familyName,
      display_name: displayName,
    })
    .eq("id", user.id);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }
  return { ok: true };
}
