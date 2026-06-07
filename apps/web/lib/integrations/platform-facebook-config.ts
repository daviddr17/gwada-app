import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type FacebookPlatformConfig = {
  appId: string;
  appSecret: string;
};

export function facebookConfigFromJson(
  raw: unknown,
): Partial<FacebookPlatformConfig> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  return {
    appId: typeof o.client_id === "string" ? o.client_id.trim() : undefined,
    appSecret:
      typeof o.client_secret === "string" ? o.client_secret.trim() : undefined,
  };
}

/** Meta App ID + App Secret (nur serverseitig). */
export async function getFacebookPlatformConfigAdmin(): Promise<FacebookPlatformConfig | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;

  const { data, error } = await admin
    .from("platform_integrations")
    .select("enabled, config")
    .eq("key", "facebook")
    .maybeSingle();

  if (error || !data?.enabled) return null;

  const cfg = facebookConfigFromJson(data.config);
  if (!cfg.appId || !cfg.appSecret) return null;

  return { appId: cfg.appId, appSecret: cfg.appSecret };
}
