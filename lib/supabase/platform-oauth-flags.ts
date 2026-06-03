import "server-only";

import type { PlatformOAuthAvailability } from "@/lib/types/platform-oauth-availability";
import { readPlatformIntegrationEnabled } from "@/lib/supabase/platform-integration-enabled";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type { PlatformOAuthAvailability };

const ALL_DISABLED: PlatformOAuthAvailability = {
  googleEnabled: false,
  googleReady: false,
  appleEnabled: false,
  appleReady: false,
};

function oauthCredentialsConfigured(
  config: Record<string, unknown> | null | undefined,
): boolean {
  const cfg = config ?? {};
  const clientId =
    typeof cfg.client_id === "string" ? cfg.client_id.trim() : "";
  const clientSecret =
    typeof cfg.client_secret === "string" ? cfg.client_secret.trim() : "";
  return Boolean(clientId && clientSecret);
}

export async function fetchPlatformOAuthAvailability(): Promise<PlatformOAuthAvailability> {
  const admin = createSupabaseAdminClient();
  if (!admin) return ALL_DISABLED;

  const { data, error } = await admin
    .from("platform_integrations")
    .select("key, enabled, config")
    .in("key", ["google_oauth", "apple_oauth"]);

  if (error) {
    console.warn("platform_integrations oauth flags", error.message);
    return ALL_DISABLED;
  }

  const rows = data ?? [];
  const googleRow = rows.find((r) => r.key === "google_oauth");
  const appleRow = rows.find((r) => r.key === "apple_oauth");

  const googleEnabled = readPlatformIntegrationEnabled(googleRow?.enabled);
  const appleEnabled = readPlatformIntegrationEnabled(appleRow?.enabled);
  const googleConfig = googleRow?.config as Record<string, unknown> | undefined;
  const appleConfig = appleRow?.config as Record<string, unknown> | undefined;

  return {
    googleEnabled,
    googleReady: googleEnabled && oauthCredentialsConfigured(googleConfig),
    appleEnabled,
    appleReady: appleEnabled && oauthCredentialsConfigured(appleConfig),
  };
}

/** Server: Provider für Login erlaubt? */
export async function isPlatformOAuthLoginProviderReady(
  provider: "google" | "apple",
): Promise<boolean> {
  const flags = await fetchPlatformOAuthAvailability();
  return provider === "google" ? flags.googleReady : flags.appleReady;
}

/** @deprecated Alias — nutze `fetchPlatformOAuthAvailability`. */
export async function fetchPlatformOAuthFlags(): Promise<PlatformOAuthAvailability> {
  return fetchPlatformOAuthAvailability();
}
