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
  const installationsByDevice = new Map<
    string,
    {
      id: string;
      installation_id: string;
      last_seen_at: string;
      user_agent: string | null;
      created_at: string;
    }[]
  >();
  if (ids.length > 0) {
    const { data: instRows } = await auth.sb
      .from("restaurant_pos_installations")
      .select("id, device_id, installation_id, last_seen_at, user_agent, created_at")
      .in("device_id", ids)
      .order("last_seen_at", { ascending: false });
    for (const row of instRows ?? []) {
      const deviceId = row.device_id as string;
      const list = installationsByDevice.get(deviceId) ?? [];
      list.push({
        id: row.id as string,
        installation_id: row.installation_id as string,
        last_seen_at: row.last_seen_at as string,
        user_agent: (row.user_agent as string | null) ?? null,
        created_at: row.created_at as string,
      });
      installationsByDevice.set(deviceId, list);
    }
  }

  return NextResponse.json({
    devices: (data ?? []).map((row) => {
      const installations = installationsByDevice.get(row.id as string) ?? [];
      return {
        ...row,
        is_paired: installations.length > 0,
        installation_count: installations.length,
        installations,
        last_seen_at: installations[0]?.last_seen_at ?? null,
      };
    }),
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
