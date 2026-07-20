import { NextResponse } from "next/server";
import {
  checkDisplayPinRateLimit,
  clearDisplayPinFailures,
  DISPLAY_PIN_MAX_FAILURES,
  recordDisplayPinFailure,
} from "@/lib/api/display-pin-rate-limit";
import {
  assertPosDeviceFromRequest,
  endPosSession,
  generatePosToken,
  hashPosToken,
  loadOpenPosSession,
  loadPosSessionStaff,
  staffCanUsePos,
  staffPosPermissionKeys,
  touchPosSession,
} from "@/lib/pos/pos-device-auth-server";
import {
  formatPosSessionHeader,
  parsePosSessionHeader,
  POS_SESSION_HEADER,
} from "@/lib/pos/pos-device-headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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

  let body: { pin?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const pin = body.pin?.trim();
  if (!pin || !/^[0-9]{4}$/.test(pin)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const pinLimit = checkDisplayPinRateLimit(deviceResult.device.id);
  if (!pinLimit.allowed) {
    return NextResponse.json(
      { error: "pin_locked" },
      {
        status: 429,
        headers: {
          "Retry-After": String(pinLimit.retryAfterSec),
          "X-RateLimit-Limit": String(DISPLAY_PIN_MAX_FAILURES),
        },
      },
    );
  }

  const { data: resolved } = await admin.rpc(
    "resolve_restaurant_staff_by_display_pin",
    {
      p_restaurant_id: deviceResult.device.restaurant_id,
      p_pin: pin,
    },
  );
  const staffId = (resolved as string | null) ?? null;

  if (!staffId) {
    recordDisplayPinFailure(deviceResult.device.id);
    return NextResponse.json({ error: "pin_invalid" }, { status: 401 });
  }

  const permissionKeys = await staffPosPermissionKeys(staffId);
  if (!staffCanUsePos(permissionKeys)) {
    recordDisplayPinFailure(deviceResult.device.id);
    return NextResponse.json({ error: "forbidden_pos" }, { status: 403 });
  }

  clearDisplayPinFailures(deviceResult.device.id);

  await admin
    .from("restaurant_pos_sessions")
    .update({ ended_at: new Date().toISOString() })
    .eq("device_id", deviceResult.device.id)
    .is("ended_at", null);

  const sessionToken = generatePosToken();
  const sessionHash = hashPosToken(sessionToken);

  const { data: session, error } = await admin
    .from("restaurant_pos_sessions")
    .insert({
      device_id: deviceResult.device.id,
      staff_id: staffId,
      restaurant_id: deviceResult.device.restaurant_id,
      session_token_hash: sessionHash,
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

export async function DELETE(request: Request) {
  const parsed = parsePosSessionHeader(request.headers.get(POS_SESSION_HEADER));
  if (parsed) {
    await endPosSession(parsed.sessionId);
  }
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request) {
  const deviceResult = await assertPosDeviceFromRequest(request);
  if (!deviceResult.ok) {
    return NextResponse.json(
      { error: deviceResult.error },
      { status: deviceResult.status },
    );
  }

  const parsed = parsePosSessionHeader(request.headers.get(POS_SESSION_HEADER));
  if (!parsed) {
    return NextResponse.json({ error: "session_locked" }, { status: 401 });
  }

  const session = await loadOpenPosSession(parsed.sessionId);
  if (!session || session.device_id !== deviceResult.device.id) {
    return NextResponse.json({ error: "session_locked" }, { status: 401 });
  }

  if (hashPosToken(parsed.token) !== session.session_token_hash) {
    return NextResponse.json({ error: "session_invalid" }, { status: 403 });
  }

  const idleMs = Date.now() - new Date(session.last_activity_at).getTime();
  if (idleMs > deviceResult.device.auto_lock_seconds * 1000) {
    await endPosSession(session.id);
    return NextResponse.json({ error: "session_expired" }, { status: 401 });
  }

  await touchPosSession(session.id);
  return NextResponse.json({ ok: true });
}
