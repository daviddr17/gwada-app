import { NextResponse } from "next/server";
import { buildPosAuthRoster } from "@/lib/pos/pos-auth-roster-server";
import {
  generatePosToken,
  upsertPosInstallation,
} from "@/lib/pos/pos-device-auth-server";
import { formatPosDeviceHeader } from "@/lib/pos/pos-device-headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 503 });
  }

  let body: { code?: string; installation_id?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const installationId = body.installation_id?.trim();
  if (!installationId || installationId.length < 8) {
    return NextResponse.json({ error: "invalid_installation_id" }, { status: 400 });
  }

  const code = body.code?.trim().toUpperCase();
  if (!code || code.length !== 8) {
    return NextResponse.json({ error: "invalid_code" }, { status: 400 });
  }

  const { data: pairing } = await admin
    .from("restaurant_pos_pairing_codes")
    .select("id, device_id, expires_at")
    .eq("code", code)
    .maybeSingle();

  if (!pairing) {
    return NextResponse.json({ error: "code_not_found" }, { status: 404 });
  }

  if (new Date(pairing.expires_at as string).getTime() < Date.now()) {
    await admin
      .from("restaurant_pos_pairing_codes")
      .delete()
      .eq("id", pairing.id);
    return NextResponse.json({ error: "code_expired" }, { status: 410 });
  }

  const { data: device } = await admin
    .from("restaurant_pos_devices")
    .select("id, restaurant_id, name, auto_lock_seconds, is_active")
    .eq("id", pairing.device_id)
    .maybeSingle();

  if (!device || !device.is_active) {
    return NextResponse.json({ error: "device_inactive" }, { status: 403 });
  }

  const { data: restaurant } = await admin
    .from("restaurants")
    .select("id, name, slug, brand_accent_hex")
    .eq("id", device.restaurant_id)
    .maybeSingle();

  if (!restaurant) {
    return NextResponse.json({ error: "restaurant_not_found" }, { status: 404 });
  }

  const deviceToken = generatePosToken();
  const installed = await upsertPosInstallation({
    deviceId: device.id as string,
    installationId,
    deviceToken,
    userAgent: request.headers.get("user-agent"),
  });

  if (!installed.ok) {
    return NextResponse.json({ error: installed.error }, { status: 500 });
  }

  await admin
    .from("restaurant_pos_pairing_codes")
    .delete()
    .eq("id", pairing.id);

  const roster = await buildPosAuthRoster({
    id: device.id as string,
    restaurant_id: device.restaurant_id as string,
    name: device.name as string,
    auto_lock_seconds: device.auto_lock_seconds as number,
    is_active: Boolean(device.is_active),
  });

  return NextResponse.json({
    ok: true,
    device_id: device.id,
    device_token: deviceToken,
    device_header: formatPosDeviceHeader(device.id as string, deviceToken),
    installation_id: installationId,
    auto_lock_seconds: device.auto_lock_seconds,
    device_name: device.name,
    restaurant: {
      id: restaurant.id,
      name: restaurant.name,
      slug: restaurant.slug,
      accent_hex: restaurant.brand_accent_hex,
    },
    roster: {
      fetched_at: roster.fetchedAt,
      staff: roster.staff,
    },
  });
}
