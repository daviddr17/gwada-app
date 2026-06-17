import { assertSuperadminApi } from "@/lib/superadmin/assert-superadmin-api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { countPendingChangelogEntries } from "@/lib/supabase/platform-changelog-db";

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

  const { count, error } = await countPendingChangelogEntries(admin);
  if (error) {
    return Response.json({ error }, { status: 500 });
  }

  return Response.json({ count });
}
