import { assertSuperadminApi } from "@/lib/superadmin/assert-superadmin-api";
import {
  getWahaServerByIdAdmin,
  updateWahaServerHealthAdmin,
  wahaServerRowToConfig,
  countWhatsappSessionsOnServerAdmin,
  wahaServerToPublic,
  refreshWahaServerCapacityWarningAdmin,
} from "@/lib/supabase/waha-servers-db";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_req: Request, context: RouteContext) {
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
    await updateWahaServerHealthAdmin(id, false, "api_key_or_url_missing");
    return Response.json({
      ok: false,
      error: "not_configured",
      server: wahaServerToPublic(row, await countWhatsappSessionsOnServerAdmin(id)),
    });
  }

  const started = Date.now();
  try {
    const res = await fetch(`${config.baseUrl}/api/sessions`, {
      headers: {
        "X-Api-Key": config.apiKey,
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`WAHA HTTP ${res.status}`);
    }
    await updateWahaServerHealthAdmin(id, true);
    await refreshWahaServerCapacityWarningAdmin(id);
    const updated = await getWahaServerByIdAdmin(id);
    return Response.json({
      ok: true,
      latencyMs: Date.now() - started,
      server: wahaServerToPublic(
        updated ?? row,
        await countWhatsappSessionsOnServerAdmin(id),
      ),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "health_failed";
    await updateWahaServerHealthAdmin(id, false, msg);
    const updated = await getWahaServerByIdAdmin(id);
    return Response.json({
      ok: false,
      error: msg,
      latencyMs: Date.now() - started,
      server: wahaServerToPublic(
        updated ?? row,
        await countWhatsappSessionsOnServerAdmin(id),
      ),
    });
  }
}
