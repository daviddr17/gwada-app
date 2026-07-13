import "server-only";

import {
  appleBusinessConnectConfigFromJson,
  type PlatformAppleBusinessConnectConfig,
} from "@/lib/integrations/platform-apple-business-connect-config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function fetchPlatformAppleBusinessConnectSecrets(): Promise<PlatformAppleBusinessConnectConfig | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;

  const { data, error } = await admin
    .from("platform_integrations")
    .select("config")
    .eq("key", "apple_business_connect")
    .maybeSingle();

  if (error || !data) {
    console.warn("fetchPlatformAppleBusinessConnectSecrets", error?.message);
    return null;
  }

  return appleBusinessConnectConfigFromJson(data.config);
}
