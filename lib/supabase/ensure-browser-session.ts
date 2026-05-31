import type { SupabaseClient } from "@supabase/supabase-js";

const SESSION_EXPIRED_MESSAGE =
  "Anmeldung abgelaufen — bitte erneut anmelden und dann nochmal speichern.";

/** Stellt sicher, dass der Browser-Client eine gültige Supabase-Session hat. */
export async function ensureBrowserSupabaseSession(
  supabase: SupabaseClient,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: initial, error: initialErr } = await supabase.auth.getSession();
  if (initialErr) {
    console.warn("[gwada] getSession", initialErr.message);
  }
  if (initial.session) return { ok: true };

  const { data: refreshed, error: refreshErr } =
    await supabase.auth.refreshSession();
  if (refreshErr) {
    console.warn("[gwada] refreshSession", refreshErr.message);
  }
  if (refreshed.session) return { ok: true };

  return { ok: false, error: SESSION_EXPIRED_MESSAGE };
}
