import { assertSuperadminApi } from "@/lib/superadmin/assert-superadmin-api";
import { listWahaSessionsAdmin } from "@/lib/supabase/waha-servers-db";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await assertSuperadminApi();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const sessions = await listWahaSessionsAdmin();
  return Response.json({ sessions });
}
