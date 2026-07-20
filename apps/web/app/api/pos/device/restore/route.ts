import { NextResponse } from "next/server";
import { restorePosInstallation } from "@/lib/pos/pos-device-auth-server";
import { formatPosDeviceHeader } from "@/lib/pos/pos-device-headers";
import { ensurePosLanSharedSecret } from "@/lib/pos/pos-lan-secret-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  let body: {
    device_id?: string;
    installation_id?: string;
    device_token?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const deviceId = body.device_id?.trim() ?? "";
  const installationId = body.installation_id?.trim() ?? "";
  const deviceToken = body.device_token?.trim() ?? "";
  if (!deviceId || !installationId || !deviceToken) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const restored = await restorePosInstallation({
    deviceId,
    installationId,
    deviceToken,
  });
  if (!restored.ok) {
    return NextResponse.json(
      { error: restored.error },
      { status: restored.status },
    );
  }

  const admin = createSupabaseAdminClient();
  const { data: restaurant } = admin
    ? await admin
        .from("restaurants")
        .select("id, name, slug, brand_accent_hex")
        .eq("id", restored.device.restaurant_id)
        .maybeSingle()
    : { data: null };

  const lanSharedSecret = await ensurePosLanSharedSecret(
    restored.device.restaurant_id,
  );

  return NextResponse.json({
    ok: true,
    device_id: restored.device.id,
    device_token: deviceToken,
    device_header: formatPosDeviceHeader(restored.device.id, deviceToken),
    installation_id: installationId,
    auto_lock_seconds: restored.device.auto_lock_seconds,
    device_name: restored.device.name,
    lan_shared_secret: lanSharedSecret,
    restaurant: restaurant
      ? {
          id: restaurant.id,
          name: restaurant.name,
          slug: restaurant.slug,
          accent_hex: restaurant.brand_accent_hex,
        }
      : {
          id: restored.device.restaurant_id,
          name: null,
          slug: null,
          accent_hex: null,
        },
  });
}
