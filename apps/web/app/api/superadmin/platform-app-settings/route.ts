import { assertSuperadminApi } from "@/lib/superadmin/assert-superadmin-api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  normalizeSidebarModuleOrder,
  type SidebarModuleId,
} from "@/lib/constants/sidebar-modules";
import {
  fetchPlatformAppBranding,
  fetchSidebarModuleOrder,
  updatePlatformAppName,
  updateSidebarModuleOrder,
} from "@/lib/supabase/platform-app-settings-db";

export const dynamic = "force-dynamic";

function jsonBranding(
  branding: Awaited<ReturnType<typeof fetchPlatformAppBranding>>,
  sidebarModuleOrder: SidebarModuleId[],
) {
  return Response.json({
    appName: branding.appName,
    logoUrl: branding.logoUrl,
    logoDarkUrl: branding.logoDarkUrl,
    faviconUrl: branding.faviconUrl,
    logoPath: branding.logoPath,
    logoDarkPath: branding.logoDarkPath,
    faviconPath: branding.faviconPath,
    sidebarModuleOrder,
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
  const sidebarModuleOrder = await fetchSidebarModuleOrder(admin);
  return jsonBranding(branding, sidebarModuleOrder);
}

export async function PATCH(req: Request) {
  const auth = await assertSuperadminApi();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await req.json().catch(() => ({}))) as {
    appName?: string;
    sidebarModuleOrder?: unknown;
  };

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  if (typeof body.appName === "string") {
    const appName = body.appName;
    if (!appName.trim()) {
      return Response.json({ error: "invalid_app_name" }, { status: 400 });
    }
    const { error } = await updatePlatformAppName(admin, appName);
    if (error) {
      return Response.json({ error }, { status: 500 });
    }
  }

  if (body.sidebarModuleOrder !== undefined) {
    const order = normalizeSidebarModuleOrder(body.sidebarModuleOrder);
    const { error } = await updateSidebarModuleOrder(admin, order);
    if (error) {
      return Response.json({ error }, { status: 500 });
    }
  }

  const branding = await fetchPlatformAppBranding(admin);
  const sidebarModuleOrder = await fetchSidebarModuleOrder(admin);
  return jsonBranding(branding, sidebarModuleOrder);
}
