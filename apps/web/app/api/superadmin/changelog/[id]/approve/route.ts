import { assertSuperadminApi } from "@/lib/superadmin/assert-superadmin-api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { approvePlatformChangelogEntry } from "@/lib/supabase/platform-changelog-db";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_req: Request, context: RouteContext) {
  const auth = await assertSuperadminApi();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await context.params;
  if (!id?.trim()) {
    return Response.json({ error: "invalid_id" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const { entry, error } = await approvePlatformChangelogEntry(
    admin,
    id,
    auth.userId,
  );
  if (error) {
    const status = error === "not_found_or_already_approved" ? 404 : 500;
    return Response.json({ error }, { status });
  }

  return Response.json({ entry });
}
