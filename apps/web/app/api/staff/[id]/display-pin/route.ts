import { NextResponse } from "next/server";
import { authorizeStaffRestaurant } from "@/lib/staff/route-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: staffId } = await context.params;
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: staff } = await sb
    .from("restaurant_staff")
    .select("id, restaurant_id")
    .eq("id", staffId)
    .maybeSingle();

  if (!staff) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const auth = await authorizeStaffRestaurant(staff.restaurant_id as string);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: { pin?: string | null };
  try {
    body = (await request.json()) as { pin?: string | null };
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 503 });
  }

  if (body.pin === null || body.pin === "") {
    const { error } = await admin.rpc("clear_restaurant_staff_display_pin", {
      p_staff_id: staffId,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  const pin = body.pin?.trim();
  if (!pin || !/^[0-9]{4}$/.test(pin)) {
    return NextResponse.json({ error: "pin_format" }, { status: 400 });
  }

  const { error } = await admin.rpc("set_restaurant_staff_display_pin", {
    p_staff_id: staffId,
    p_pin: pin,
  });

  if (error) {
    const msg = error.message.includes("bereits")
      ? "pin_duplicate"
      : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: staffId } = await context.params;
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: staff } = await sb
    .from("restaurant_staff")
    .select("display_pin_set_at, restaurant_id")
    .eq("id", staffId)
    .maybeSingle();

  if (!staff) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const auth = await authorizeStaffRestaurant(staff.restaurant_id as string);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  return NextResponse.json({
    has_pin: Boolean(staff.display_pin_set_at),
    set_at: staff.display_pin_set_at,
  });
}
