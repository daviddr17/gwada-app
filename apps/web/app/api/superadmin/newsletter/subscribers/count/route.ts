import { assertSuperadminApi } from "@/lib/superadmin/assert-superadmin-api";
import { countOptedInSubscribers } from "@/lib/supabase/platform-newsletter-db";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await assertSuperadminApi();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }
  try {
    const count = await countOptedInSubscribers(admin);
    return Response.json({ count });
  } catch (e) {
    const message = e instanceof Error ? e.message : "count_failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
