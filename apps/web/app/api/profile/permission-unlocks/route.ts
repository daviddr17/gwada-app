import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import type { PermissionUnlockPayload } from "@/lib/profile/permission-unlock-types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const restaurantId = url.searchParams.get("restaurantId")?.trim() ?? "";
  if (!isUuidRestaurantId(restaurantId)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data, error } = await sb
    .from("user_permission_unlocks")
    .select(
      "id, permission_keys, permission_labels, position_name, granted_at",
    )
    .eq("profile_id", user.id)
    .eq("restaurant_id", restaurantId)
    .is("seen_at", null)
    .order("granted_at", { ascending: true })
    .limit(10);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const unlocks: PermissionUnlockPayload[] = (data ?? []).map((row) => {
    const r = row as {
      id: string;
      permission_keys: string[] | null;
      permission_labels: string[] | null;
      position_name: string | null;
      granted_at: string;
    };
    return {
      id: r.id,
      permissionKeys: r.permission_keys ?? [],
      permissionLabels: r.permission_labels ?? [],
      positionName: r.position_name,
      grantedAt: r.granted_at,
    };
  });

  return NextResponse.json({ data: { unlocks } });
}

export async function POST(req: Request) {
  let body: { restaurantId?: string; unlockIds?: string[] };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const restaurantId = body.restaurantId?.trim() ?? "";
  const unlockIds = Array.isArray(body.unlockIds)
    ? body.unlockIds.filter((id): id is string => typeof id === "string")
    : [];
  if (!isUuidRestaurantId(restaurantId) || unlockIds.length === 0) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { error } = await sb
    .from("user_permission_unlocks")
    .update({ seen_at: new Date().toISOString() })
    .eq("profile_id", user.id)
    .eq("restaurant_id", restaurantId)
    .in("id", unlockIds)
    .is("seen_at", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
