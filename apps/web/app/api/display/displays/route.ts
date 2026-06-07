import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import type { DisplayModule } from "@/lib/display/display-types";

async function assertDisplayManage(restaurantId: string) {
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
    p_permission: "display.manage",
  });
  if (!allowed) {
    return { ok: false as const, error: "forbidden", status: 403 };
  }
  return { ok: true as const, sb };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const restaurantId = url.searchParams.get("restaurantId") ?? "";
  const auth = await assertDisplayManage(restaurantId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { data, error } = await auth.sb
    .from("restaurant_displays")
    .select(
      "id, restaurant_id, name, allowed_modules, auto_lock_seconds, is_active, device_secret_hash, created_at",
    )
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const ids = (data ?? []).map((r) => r.id as string);
  const pairedIds = new Set<string>();
  if (ids.length > 0) {
    const { data: instRows } = await auth.sb
      .from("restaurant_display_installations")
      .select("display_id")
      .in("display_id", ids);
    for (const row of instRows ?? []) {
      pairedIds.add(row.display_id as string);
    }
  }

  const displays = (data ?? []).map((row) => ({
    id: row.id,
    restaurant_id: row.restaurant_id,
    name: row.name,
    allowed_modules: row.allowed_modules,
    auto_lock_seconds: row.auto_lock_seconds,
    is_active: row.is_active,
    is_paired:
      pairedIds.has(row.id as string) || Boolean(row.device_secret_hash),
    created_at: row.created_at,
  }));

  return NextResponse.json({ displays });
}

export async function POST(request: Request) {
  let body: {
    restaurantId?: string;
    name?: string;
    allowed_modules?: DisplayModule[];
    auto_lock_seconds?: number;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const restaurantId = body.restaurantId ?? "";
  const auth = await assertDisplayManage(restaurantId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { data, error } = await auth.sb
    .from("restaurant_displays")
    .insert({
      restaurant_id: restaurantId,
      name,
      allowed_modules: body.allowed_modules ?? [],
      auto_lock_seconds: body.auto_lock_seconds ?? 60,
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "create_failed" }, { status: 500 });
  }

  return NextResponse.json({ id: data.id });
}
