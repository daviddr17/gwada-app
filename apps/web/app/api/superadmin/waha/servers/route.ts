import { assertSuperadminApi } from "@/lib/superadmin/assert-superadmin-api";
import {
  createWahaServerAdmin,
  listActiveWahaCapacityAlertsAdmin,
  listWahaServersPublicAdmin,
  wahaServerToPublic,
} from "@/lib/supabase/waha-servers-db";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await assertSuperadminApi();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const [servers, capacityAlerts] = await Promise.all([
    listWahaServersPublicAdmin(),
    listActiveWahaCapacityAlertsAdmin(),
  ]);

  return Response.json({ servers, capacityAlerts });
}

export async function POST(req: Request) {
  const auth = await assertSuperadminApi();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    base_url?: string;
    api_key?: string;
    enabled?: boolean;
    accept_new_sessions?: boolean;
    session_limit?: number;
    warn_remaining?: number;
    sort_order?: number;
    notes?: string | null;
  };

  const { row, error } = await createWahaServerAdmin({
    name: body.name?.trim() ?? "",
    base_url: body.base_url?.trim() ?? "",
    api_key: body.api_key,
    enabled: body.enabled,
    accept_new_sessions: body.accept_new_sessions,
    session_limit: body.session_limit,
    warn_remaining: body.warn_remaining,
    sort_order: body.sort_order,
    notes: body.notes,
  });

  if (error || !row) {
    const status =
      error === "name_required" ||
      error === "base_url_required" ||
      error === "api_key_required"
        ? 400
        : 500;
    return Response.json({ error: error ?? "create_failed" }, { status });
  }

  return Response.json({ server: wahaServerToPublic(row, 0) });
}
