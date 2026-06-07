import "server-only";

import { resolveEmailLogoAbsoluteUrl } from "@/lib/email/resolve-email-logo-url";
import { getPublicSiteUrl } from "@/lib/public-env";
import { fetchPlatformAppBranding } from "@/lib/supabase/platform-app-settings-db";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

export type TransactionalEmailBranding = {
  appName: string;
  logoUrl: string | null;
  origin: string;
};

export async function fetchTransactionalEmailBranding(
  brandingClient?: SupabaseClient,
): Promise<TransactionalEmailBranding> {
  const origin =
    getPublicSiteUrl()?.replace(/\/+$/, "") ?? "http://localhost:3000";
  const client = brandingClient ?? createSupabaseAdminClient();
  if (!client) {
    return { appName: "Gwada", logoUrl: null, origin };
  }
  const branding = await fetchPlatformAppBranding(client);
  return {
    appName: branding.appName,
    logoUrl: resolveEmailLogoAbsoluteUrl(origin, branding),
    origin,
  };
}
