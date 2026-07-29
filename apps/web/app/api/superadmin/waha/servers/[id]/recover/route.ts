import { assertSuperadminApi } from "@/lib/superadmin/assert-superadmin-api";
import { runWahaSessionRecoverCron } from "@/lib/waha/waha-session-recover-server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** Sessions dieses Servers neu starten (WAHA-API) + bei Bedarf Container. */
export async function POST(req: Request, context: RouteContext) {
  const auth = await assertSuperadminApi();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await context.params;
  const body = (await req.json().catch(() => ({}))) as {
    forceContainerRestart?: boolean;
  };

  const stats = await runWahaSessionRecoverCron(null, {
    serverId: id,
    forceContainerRestart: body.forceContainerRestart === true,
  });

  return Response.json(stats);
}
