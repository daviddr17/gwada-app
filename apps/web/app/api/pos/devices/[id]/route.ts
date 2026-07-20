import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function loadManagedDevice(id: string) {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return { ok: false as const, error: "unauthorized", status: 401 };
  }

  const { data: device } = await sb
    .from("restaurant_pos_devices")
    .select("id, restaurant_id, name, auto_lock_seconds, is_active")
    .eq("id", id)
    .maybeSingle();

  if (!device) {
    return { ok: false as const, error: "not_found", status: 404 };
  }

  const { data: allowed } = await sb.rpc("auth_has_restaurant_permission", {
    p_restaurant_id: device.restaurant_id,
    p_permission: "pos.kasse.manage",
  });
  if (!allowed) {
    return { ok: false as const, error: "forbidden", status: 403 };
  }

  return { ok: true as const, sb, device };
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const auth = await loadManagedDevice(id);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: {
    name?: string;
    auto_lock_seconds?: number;
    is_active?: boolean;
    unpair?: boolean;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  if (body.unpair) {
    const admin = createSupabaseAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "server_misconfigured" }, { status: 503 });
    }
    await admin
      .from("restaurant_pos_sessions")
      .update({ ended_at: new Date().toISOString() })
      .eq("device_id", id)
      .is("ended_at", null);
    await admin.from("restaurant_pos_installations").delete().eq("device_id", id);
    await admin.from("restaurant_pos_pairing_codes").delete().eq("device_id", id);
  }

  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) {
    const name = body.name.trim();
    if (!name || name.length > 80) {
      return NextResponse.json({ error: "invalid_name" }, { status: 400 });
    }
    patch.name = name;
  }
  if (body.auto_lock_seconds !== undefined) {
    if (body.auto_lock_seconds < 30 || body.auto_lock_seconds > 86400) {
      return NextResponse.json({ error: "invalid_auto_lock" }, { status: 400 });
    }
    patch.auto_lock_seconds = body.auto_lock_seconds;
  }
  if (body.is_active !== undefined) {
    patch.is_active = body.is_active;
  }

  if (Object.keys(patch).length > 0) {
    const { error } = await auth.sb
      .from("restaurant_pos_devices")
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
  const auth = await loadManagedDevice(id);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { error } = await auth.sb
    .from("restaurant_pos_devices")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
