import { assertSuperadminApi } from "@/lib/superadmin/assert-superadmin-api";
import {
  countWhatsappSessionsOnServerAdmin,
  deleteWahaServerAdmin,
  updateWahaServerAdmin,
  wahaServerToPublic,
} from "@/lib/supabase/waha-servers-db";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, context: RouteContext) {
  const auth = await assertSuperadminApi();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await context.params;
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
    clear_capacity_warning?: boolean;
  };

  const { row, error } = await updateWahaServerAdmin(id, {
    ...(body.name !== undefined ? { name: body.name.trim() } : {}),
    ...(body.base_url !== undefined ? { base_url: body.base_url.trim() } : {}),
    ...(body.api_key !== undefined ? { api_key: body.api_key } : {}),
    ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
    ...(body.accept_new_sessions !== undefined
      ? { accept_new_sessions: body.accept_new_sessions }
      : {}),
    ...(body.session_limit !== undefined
      ? { session_limit: body.session_limit }
      : {}),
    ...(body.warn_remaining !== undefined
      ? { warn_remaining: body.warn_remaining }
      : {}),
    ...(body.sort_order !== undefined ? { sort_order: body.sort_order } : {}),
    ...(body.notes !== undefined ? { notes: body.notes } : {}),
    clear_capacity_warning: body.clear_capacity_warning,
  });

  if (error === "not_found") {
    return Response.json({ error }, { status: 404 });
  }
  if (error || !row) {
    const status =
      error === "base_url_required" || error === "api_key_required"
        ? 400
        : 500;
    return Response.json({ error: error ?? "update_failed" }, { status });
  }

  const count = await countWhatsappSessionsOnServerAdmin(row.id);
  return Response.json({ server: wahaServerToPublic(row, count) });
}

export async function DELETE(_req: Request, context: RouteContext) {
  const auth = await assertSuperadminApi();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await context.params;
  const { error } = await deleteWahaServerAdmin(id);
  if (error === "server_has_sessions") {
    return Response.json(
      {
        error,
        message:
          "Server hat noch zugewiesene Sessions. Zuerst Sessions umziehen oder Restaurant trennen.",
      },
      { status: 409 },
    );
  }
  if (error) {
    return Response.json({ error }, { status: 500 });
  }
  return Response.json({ ok: true });
}
