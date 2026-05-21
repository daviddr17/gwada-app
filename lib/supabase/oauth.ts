import type { SupabaseClient } from "@supabase/supabase-js";
import { safeInternalPath } from "@/lib/navigation/safe-internal-path";

export type GwadaOAuthProvider = "google" | "apple";

export function buildOAuthCallbackUrl(nextPath?: string | null): string {
  if (typeof window === "undefined") {
    return `/auth/callback?next=${encodeURIComponent(safeInternalPath(nextPath))}`;
  }
  const next = encodeURIComponent(safeInternalPath(nextPath));
  return `${window.location.origin}/auth/callback?next=${next}`;
}

export function identityHasProvider(
  identities: { provider: string }[] | undefined,
  provider: GwadaOAuthProvider,
): boolean {
  return (identities ?? []).some((i) => i.provider === provider);
}

/**
 * Anmelden, Registrieren (neuer User) oder Verknüpfen (eingeloggt, `link: true`).
 * Browser leitet auf `data.url` um.
 */
export async function startOAuthFlow(
  supabase: SupabaseClient,
  provider: GwadaOAuthProvider,
  options?: { next?: string | null; link?: boolean },
): Promise<{ error: Error | null }> {
  const redirectTo = buildOAuthCallbackUrl(
    options?.link ? "/profile/anmeldung" : options?.next,
  );

  if (options?.link) {
    const { data, error } = await supabase.auth.linkIdentity({
      provider,
      options: {
        redirectTo,
        ...(provider === "google"
          ? { queryParams: { prompt: "select_account" } }
          : {}),
        scopes: provider === "apple" ? "name email" : undefined,
      },
    });
    if (error) return { error };
    if (data?.url) window.location.assign(data.url);
    return { error: null };
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      ...(provider === "google"
        ? { queryParams: { prompt: "select_account" } }
        : {}),
      scopes: provider === "apple" ? "name email" : undefined,
    },
  });
  if (error) return { error };
  if (data?.url) window.location.assign(data.url);
  return { error: null };
}

export async function unlinkOAuthProvider(
  supabase: SupabaseClient,
  provider: GwadaOAuthProvider,
): Promise<{ error: Error | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const identity = user?.identities?.find((i) => i.provider === provider);
  if (!identity) {
    return { error: new Error("Dieses Konto ist nicht verknüpft.") };
  }
  const { error } = await supabase.auth.unlinkIdentity(identity);
  return { error: error ?? null };
}
