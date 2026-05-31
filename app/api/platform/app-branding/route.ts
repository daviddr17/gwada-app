import {
  DEFAULT_PLATFORM_APP_BRANDING,
  fetchPlatformAppBranding,
} from "@/lib/supabase/platform-app-settings-db";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const sb = await createSupabaseServerClient();
  if (!sb) {
    return Response.json(DEFAULT_PLATFORM_APP_BRANDING);
  }

  const branding = await fetchPlatformAppBranding(sb);
  return Response.json({
    appName: branding.appName,
    logoUrl: branding.logoUrl,
    logoDarkUrl: branding.logoDarkUrl,
    faviconUrl: branding.faviconUrl,
    logoPath: branding.logoPath,
    logoDarkPath: branding.logoDarkPath,
    faviconPath: branding.faviconPath,
  });
}
