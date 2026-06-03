import type { SupabaseClient } from "@supabase/supabase-js";
import { safeInternalPath } from "@/lib/navigation/safe-internal-path";

export type GwadaOAuthProvider = "google" | "apple";

/** Google-Login über Plattform-Credentials (Superadmin), nicht Supabase-hosted OAuth. */
export function startGooglePlatformOAuth(options?: {
  next?: string | null;
  link?: boolean;
}): void {
  if (typeof window === "undefined") return;
  const q = new URLSearchParams();
  if (options?.link) {
    q.set("link", "1");
  } else {
    q.set("next", safeInternalPath(options?.next));
  }
  window.location.assign(`/api/auth/google/connect?${q}`);
}

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
async function assertOAuthProviderAvailable(
  provider: GwadaOAuthProvider,
): Promise<Error | null> {
  try {
    const res = await fetch("/api/public/oauth-flags", { cache: "no-store" });
    if (!res.ok) {
      return new Error("Anmeldeoptionen konnten nicht geladen werden.");
    }
    const data = (await res.json()) as {
      googleEnabled?: boolean;
      googleReady?: boolean;
      appleEnabled?: boolean;
      appleReady?: boolean;
    };
    if (provider === "google") {
      if (!data.googleEnabled) {
        return new Error("Google-Anmeldung ist deaktiviert.");
      }
      if (!data.googleReady) {
        return new Error("Google-Anmeldung ist nicht vollständig konfiguriert.");
      }
      return null;
    }
    if (!data.appleEnabled) {
      return new Error("Apple-Anmeldung ist deaktiviert.");
    }
    if (!data.appleReady) {
      return new Error("Apple-Anmeldung ist nicht vollständig konfiguriert.");
    }
    return null;
  } catch {
    return new Error("Anmeldeoptionen konnten nicht geladen werden.");
  }
}

export async function startOAuthFlow(
  supabase: SupabaseClient,
  provider: GwadaOAuthProvider,
  options?: { next?: string | null; link?: boolean },
): Promise<{ error: Error | null }> {
  const availabilityError = await assertOAuthProviderAvailable(provider);
  if (availabilityError) return { error: availabilityError };

  if (provider === "google") {
    startGooglePlatformOAuth({
      next: options?.link ? "/profile/anmeldung" : options?.next,
      link: options?.link,
    });
    return { error: null };
  }

  const redirectTo = buildOAuthCallbackUrl(
    options?.link ? "/profile/anmeldung" : options?.next,
  );

  if (options?.link) {
    const { data, error } = await supabase.auth.linkIdentity({
      provider,
      options: {
        redirectTo,
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
