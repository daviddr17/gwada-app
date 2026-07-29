import { assertSuperadminApi } from "@/lib/superadmin/assert-superadmin-api";
import {
  getWahaServerByIdAdmin,
  wahaServerRowToConfig,
} from "@/lib/supabase/waha-servers-db";
import { buildWahaVersionStatus } from "@/lib/waha/waha-version-server";
import { normalizeWahaVersion } from "@/lib/waha/waha-version";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** Aktuelle WAHA-Version (API) + neueste Release (GitHub). */
export async function GET(_req: Request, context: RouteContext) {
  const auth = await assertSuperadminApi();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await context.params;
  const row = await getWahaServerByIdAdmin(id);
  if (!row) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const config = wahaServerRowToConfig(row);
  if (!config) {
    return Response.json(
      { error: "not_configured", message: "base_url oder api_key fehlen." },
      { status: 400 },
    );
  }

  const status = await buildWahaVersionStatus({
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
  });

  return Response.json({
    ok: status.current.ok,
    currentVersion: normalizeWahaVersion(status.current.version),
    currentVersionRaw: status.current.version,
    engine: status.current.engine,
    nodeVersion: status.current.nodeVersion,
    latestVersion: status.latest?.version ?? null,
    latestPublishedAt: status.latest?.publishedAt ?? null,
    latestHtmlUrl: status.latest?.htmlUrl ?? null,
    updateAvailable: status.updateAvailable,
    error: status.current.ok ? undefined : status.current.error,
    canUpdate: Boolean(
      row.docker_container_name?.trim() &&
        ((row.ssh_host?.trim() && row.ssh_private_key?.trim()) ||
          !row.ssh_host?.trim()),
    ),
  });
}
