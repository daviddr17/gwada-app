import { assertSuperadminApi } from "@/lib/superadmin/assert-superadmin-api";
import { loadProductUsageAnalytics } from "@/lib/analytics/platform-analytics-read";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await assertSuperadminApi();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 500 });
  }

  const url = new URL(request.url);
  const result = await loadProductUsageAnalytics(admin, {
    range: url.searchParams.get("range"),
    moduleId: url.searchParams.get("module"),
    restaurantId: url.searchParams.get("restaurant"),
  });
  if (!result.ok) {
    const status = result.error === "query_failed" ? 500 : 409;
    return Response.json(
      { error: result.error },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
  return Response.json(result.data, { headers: { "Cache-Control": "no-store" } });
}
