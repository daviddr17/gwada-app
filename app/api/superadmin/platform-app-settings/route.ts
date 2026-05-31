import { assertSuperadminApi } from "@/lib/superadmin/assert-superadmin-api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  fetchPlatformAppBranding,
  updatePlatformAppName,
} from "@/lib/supabase/platform-app-settings-db";

export const dynamic = "force-dynamic";

function jsonBranding(
  branding: Awaited<ReturnType<typeof fetchPlatformAppBranding>>,
) {
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

export async function GET() {
  const auth = await assertSuperadminApi();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const branding = await fetchPlatformAppBranding(admin);
  return jsonBranding(branding);
}

export async function PATCH(req: Request) {
  const auth = await assertSuperadminApi();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await req.json().catch(() => ({}))) as { appName?: string };
  const appName = typeof body.appName === "string" ? body.appName : "";
  if (!appName.trim()) {
    return Response.json({ error: "invalid_app_name" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const { error } = await updatePlatformAppName(admin, appName);
  if (error) {
    return Response.json({ error }, { status: 500 });
  }

  const branding = await fetchPlatformAppBranding(admin);
  return jsonBranding(branding);
}
