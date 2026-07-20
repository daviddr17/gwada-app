import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

async function assertPosDeviceManage(restaurantId: string) {
  if (!isUuidRestaurantId(restaurantId)) {
    return { ok: false as const, error: "invalid_request", status: 400 };
  }
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return { ok: false as const, error: "unauthorized", status: 401 };
  }
  const { data: allowed } = await sb.rpc("auth_has_restaurant_permission", {
    p_restaurant_id: restaurantId,
    p_permission: "pos.kasse.manage",
  });
  if (!allowed) {
    return { ok: false as const, error: "forbidden", status: 403 };
  }
  return { ok: true as const, sb };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const restaurantId = url.searchParams.get("restaurantId") ?? "";
  const auth = await assertPosDeviceManage(restaurantId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { data, error } = await auth.sb
    .from("restaurant_pos_devices")
    .select("id, restaurant_id, name, auto_lock_seconds, is_active, created_at")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const ids = (data ?? []).map((r) => r.id as string);
  const pairedIds = new Set<string>();
  if (ids.length > 0) {
    const { data: instRows } = await auth.sb
      .from("restaurant_pos_installations")
      .select("device_id")
      .in("device_id", ids);
    for (const row of instRows ?? []) {
      pairedIds.add(row.device_id as string);
    }
  }

  return NextResponse.json({
    devices: (data ?? []).map((row) => ({
      ...row,
      is_paired: pairedIds.has(row.id as string),
    })),
  });
}

export async function POST(request: Request) {
  let body: {
    restaurantId?: string;
    name?: string;
    auto_lock_seconds?: number;
    is_active?: boolean;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const restaurantId = body.restaurantId?.trim() ?? "";
  const auth = await assertPosDeviceManage(restaurantId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const name = body.name?.trim() ?? "";
  if (!name || name.length > 80) {
    return NextResponse.json({ error: "invalid_name" }, { status: 400 });
  }

  const autoLock = body.auto_lock_seconds ?? 300;
  if (autoLock < 30 || autoLock > 86400) {
    return NextResponse.json({ error: "invalid_auto_lock" }, { status: 400 });
  }

  const { data, error } = await auth.sb
    .from("restaurant_pos_devices")
    .insert({
      restaurant_id: restaurantId,
      name,
      auto_lock_seconds: autoLock,
      is_active: body.is_active ?? true,
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "create_failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ id: data.id as string });
}
