import { NextResponse } from "next/server";
import { assertRestaurantStaffApi } from "@/lib/documents/assert-restaurant-staff-api";
import {
  readProfileDisplayPinStatus,
  setProfileDisplayPinSelfService,
} from "@/lib/staff/staff-display-pin-self-service-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveRequestOrigin } from "@/lib/navigation/request-origin";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const restaurantId =
    new URL(req.url).searchParams.get("restaurantId")?.trim() ?? "";

  if (!isUuidRestaurantId(restaurantId)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const auth = await assertRestaurantStaffApi(restaurantId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const result = await readProfileDisplayPinStatus({
    restaurantId,
    userId: auth.userId,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    has_pin: result.hasPin,
    set_at: result.setAt,
    self_service_enabled: result.selfServiceEnabled,
  });
}

export async function POST(req: Request) {
  let body: {
    restaurantId?: string;
    pin?: string | null;
    pinConfirm?: string;
    currentPassword?: string;
  };

  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const restaurantId = body.restaurantId?.trim() ?? "";
  if (!isUuidRestaurantId(restaurantId)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const auth = await assertRestaurantStaffApi(restaurantId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const password = body.currentPassword?.trim() ?? "";
  if (!password) {
    return NextResponse.json({ error: "password_required" }, { status: 400 });
  }

  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();

  const pinValue =
    body.pin === null || body.pin === ""
      ? null
      : typeof body.pin === "string"
        ? body.pin.trim()
        : undefined;

  if (pinValue === undefined) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  if (pinValue !== null) {
    if (!/^[0-9]{4}$/.test(pinValue)) {
      return NextResponse.json({ error: "pin_format" }, { status: 400 });
    }
    const confirm = body.pinConfirm?.trim() ?? "";
    if (pinValue !== confirm) {
      return NextResponse.json({ error: "pin_mismatch" }, { status: 400 });
    }
  }

  const origin = await resolveRequestOrigin();
  const result = await setProfileDisplayPinSelfService({
    restaurantId,
    userId: auth.userId,
    userEmail: user?.email ?? null,
    password,
    pin: pinValue,
    origin,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true });
}
