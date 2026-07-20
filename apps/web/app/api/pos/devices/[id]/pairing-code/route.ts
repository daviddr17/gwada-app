import { NextResponse } from "next/server";
import { generatePairingCode } from "@/lib/pos/pos-device-auth-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: device } = await sb
    .from("restaurant_pos_devices")
    .select("id, restaurant_id, name")
    .eq("id", id)
    .maybeSingle();

  if (!device) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { data: allowed } = await sb.rpc("auth_has_restaurant_permission", {
    p_restaurant_id: device.restaurant_id,
    p_permission: "pos.kasse.manage",
  });
  if (!allowed) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 503 });
  }

  await admin.from("restaurant_pos_pairing_codes").delete().eq("device_id", id);

  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  let code = generatePairingCode();
  let insertError: string | null = null;

  for (let attempt = 0; attempt < 5; attempt++) {
    const { error } = await admin.from("restaurant_pos_pairing_codes").insert({
      device_id: id,
      code,
      expires_at: expiresAt,
    });
    if (!error) {
      insertError = null;
      break;
    }
    if (error.code === "23505") {
      code = generatePairingCode();
      continue;
    }
    insertError = error.message;
    break;
  }

  if (insertError) {
    return NextResponse.json({ error: insertError }, { status: 500 });
  }

  return NextResponse.json({
    code,
    expires_at: expiresAt,
    device_name: device.name,
  });
}
