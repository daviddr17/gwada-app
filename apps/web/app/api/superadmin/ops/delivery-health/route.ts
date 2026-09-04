import { assertSuperadminApi } from "@/lib/superadmin/assert-superadmin-api";
import { loadDeliveryHealthSnapshot } from "@/lib/ops/load-delivery-health";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await assertSuperadminApi();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 500 });
  }

  const health = await loadDeliveryHealthSnapshot(admin);
  return Response.json(health);
}
