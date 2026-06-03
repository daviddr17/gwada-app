import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { DisplayModule } from "@/lib/display/display-types";
import { deleteDisplayInstallations } from "@/lib/display/display-installation-server";

async function assertDisplayManageForDisplay(displayId: string) {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return { ok: false as const, error: "unauthorized", status: 401 };
  }

  const { data: display } = await sb
    .from("restaurant_displays")
    .select("id, restaurant_id")
    .eq("id", displayId)
    .maybeSingle();

  if (!display) {
    return { ok: false as const, error: "not_found", status: 404 };
  }

  const { data: allowed } = await sb.rpc("auth_has_restaurant_permission", {
    p_restaurant_id: display.restaurant_id,
    p_permission: "display.manage",
  });
  if (!allowed) {
    return { ok: false as const, error: "forbidden", status: 403 };
  }

  return { ok: true as const, sb, display };
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const auth = await assertDisplayManageForDisplay(id);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: {
    name?: string;
    allowed_modules?: DisplayModule[];
    auto_lock_seconds?: number;
    is_active?: boolean;
    unpair?: boolean;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) patch.name = body.name.trim();
  if (body.allowed_modules !== undefined) patch.allowed_modules = body.allowed_modules;
  if (body.auto_lock_seconds !== undefined) {
    patch.auto_lock_seconds = body.auto_lock_seconds;
  }
  if (body.is_active !== undefined) patch.is_active = body.is_active;
  if (body.unpair) {
    await deleteDisplayInstallations(id);
    await auth.sb
      .from("restaurant_display_sessions")
      .update({ ended_at: new Date().toISOString() })
      .eq("display_id", id)
      .is("ended_at", null);
  }

  if (Object.keys(patch).length > 0) {
    const { error } = await auth.sb
      .from("restaurant_displays")
      .update(patch)
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const auth = await assertDisplayManageForDisplay(id);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { error } = await auth.sb.from("restaurant_displays").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
