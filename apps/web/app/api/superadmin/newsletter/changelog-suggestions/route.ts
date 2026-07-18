import { assertSuperadminApi } from "@/lib/superadmin/assert-superadmin-api";
import { fetchPlatformChangelogEntries } from "@/lib/supabase/platform-changelog-db";
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

  const { entries, error } = await fetchPlatformChangelogEntries(admin);
  if (error) {
    return Response.json({ error }, { status: 500 });
  }
  return Response.json({ entries: entries.slice(0, 12) });
}
