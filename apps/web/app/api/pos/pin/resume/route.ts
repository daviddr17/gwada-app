import { NextResponse } from "next/server";
import {
  assertPosDeviceFromRequest,
  generatePosToken,
  hashPosToken,
  loadPosSessionStaff,
  staffCanUsePos,
  staffPosPermissionKeys,
} from "@/lib/pos/pos-device-auth-server";
import { formatPosSessionHeader } from "@/lib/pos/pos-device-headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Offline-PIN-Session → echte Cloud-Session, wenn wieder online.
 * Gerät ist bereits gekoppelt; Staff muss weiter POS-Rechte haben.
 */
export async function POST(request: Request) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const deviceResult = await assertPosDeviceFromRequest(request);
  if (!deviceResult.ok) {
    return NextResponse.json(
      { error: deviceResult.error },
      { status: deviceResult.status },
    );
  }

  let body: { staff_id?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const staffId = body.staff_id?.trim() ?? "";
  if (!staffId) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { data: staffRow } = await admin
    .from("restaurant_staff")
    .select("id, restaurant_id, is_active, display_pin_hash")
    .eq("id", staffId)
    .maybeSingle();

  if (
    !staffRow ||
    !staffRow.is_active ||
    staffRow.restaurant_id !== deviceResult.device.restaurant_id ||
    !staffRow.display_pin_hash
  ) {
    return NextResponse.json({ error: "pin_invalid" }, { status: 401 });
  }

  const permissionKeys = await staffPosPermissionKeys(staffId);
  if (!staffCanUsePos(permissionKeys)) {
    return NextResponse.json({ error: "forbidden_pos" }, { status: 403 });
  }

  await admin
    .from("restaurant_pos_sessions")
    .update({ ended_at: new Date().toISOString() })
    .eq("device_id", deviceResult.device.id)
    .is("ended_at", null);

  const sessionToken = generatePosToken();
  const { data: session, error } = await admin
    .from("restaurant_pos_sessions")
    .insert({
      device_id: deviceResult.device.id,
      staff_id: staffId,
      restaurant_id: deviceResult.device.restaurant_id,
      session_token_hash: hashPosToken(sessionToken),
    })
    .select("id")
    .single();

  if (error || !session) {
    return NextResponse.json(
      { error: error?.message ?? "session_failed" },
      { status: 500 },
    );
  }

  const staff = await loadPosSessionStaff(staffId);
  const staffName = staff
    ? `${staff.given_name} ${staff.family_name}`.trim()
    : "";

  return NextResponse.json({
    ok: true,
    session_id: session.id,
    session_token: sessionToken,
    session_header: formatPosSessionHeader(
      session.id as string,
      sessionToken,
    ),
    auto_lock_seconds: deviceResult.device.auto_lock_seconds,
    restaurant_id: deviceResult.device.restaurant_id,
    staff: staff
      ? {
          id: staff.id,
          name: staffName,
          given_name: staff.given_name,
          family_name: staff.family_name,
          profile_id: staff.profile_id,
          position_name: staff.position_name,
        }
      : { id: staffId, name: staffName },
    permissions: Array.from(permissionKeys),
  });
}
