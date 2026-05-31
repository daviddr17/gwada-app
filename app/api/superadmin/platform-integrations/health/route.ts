import { assertSuperadminApi } from "@/lib/superadmin/assert-superadmin-api";
import { buildSuperadminIntegrationHealthMap } from "@/lib/superadmin/superadmin-ops-status-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await assertSuperadminApi();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const health = await buildSuperadminIntegrationHealthMap();
  return Response.json(health);
}
