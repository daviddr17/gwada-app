import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { PlatformIntegrationKey } from "@/lib/types/platform-integration";

/** Nur explizit `true` zählt als aktiv (kein truthy-Casting). */
export function readPlatformIntegrationEnabled(value: unknown): boolean {
  return value === true;
}

/** Liest `enabled` für einen Plattform-Key (Service Role, server-only). */
export async function isPlatformIntegrationEnabledAdmin(
  key: PlatformIntegrationKey,
): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  if (!admin) return false;

  const { data, error } = await admin
    .from("platform_integrations")
    .select("enabled")
    .eq("key", key)
    .maybeSingle();

  if (error) {
    console.warn("platform_integrations.enabled", key, error.message);
    return false;
  }

  if (!data) return false;
  return readPlatformIntegrationEnabled(data.enabled);
}
