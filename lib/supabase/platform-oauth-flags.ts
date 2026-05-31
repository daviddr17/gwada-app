import "server-only";

import { readPlatformIntegrationEnabled } from "@/lib/supabase/platform-integration-enabled";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type PlatformOAuthFlags = {
  googleEnabled: boolean;
  appleEnabled: boolean;
};

const ALL_DISABLED: PlatformOAuthFlags = {
  googleEnabled: false,
  appleEnabled: false,
};

export async function fetchPlatformOAuthFlags(): Promise<PlatformOAuthFlags> {
  const admin = createSupabaseAdminClient();
  if (!admin) return ALL_DISABLED;

  const { data, error } = await admin
    .from("platform_integrations")
    .select("key, enabled")
    .in("key", ["google_oauth", "apple_oauth"]);

  if (error) {
    console.warn("platform_integrations oauth flags", error.message);
    return ALL_DISABLED;
  }

  const map = new Map(
    (data ?? []).map((row) => [
      row.key as string,
      readPlatformIntegrationEnabled(row.enabled),
    ]),
  );

  return {
    googleEnabled: map.get("google_oauth") ?? false,
    appleEnabled: map.get("apple_oauth") ?? false,
  };
}
