import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  generateDisplayToken,
  hashDisplayToken,
} from "@/lib/display/display-auth-server";
import {
  DISPLAY_DEVICE_COOKIE,
  displayCookieOptions,
  formatDisplayDeviceCookie,
} from "@/lib/display/display-cookies";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 503 });
  }

  let body: { code?: string };
  try {
    body = (await request.json()) as { code?: string };
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const code = body.code?.trim().toUpperCase();
  if (!code || code.length !== 8) {
    return NextResponse.json({ error: "invalid_code" }, { status: 400 });
  }

  const { data: pairing } = await admin
    .from("restaurant_display_pairing_codes")
    .select("id, display_id, expires_at")
    .eq("code", code)
    .maybeSingle();

  if (!pairing) {
    return NextResponse.json({ error: "code_not_found" }, { status: 404 });
  }

  if (new Date(pairing.expires_at as string).getTime() < Date.now()) {
    await admin
      .from("restaurant_display_pairing_codes")
      .delete()
      .eq("id", pairing.id);
    return NextResponse.json({ error: "code_expired" }, { status: 410 });
  }

  const { data: display } = await admin
    .from("restaurant_displays")
    .select(
      "id, restaurant_id, name, allowed_modules, auto_lock_seconds, is_active",
    )
    .eq("id", pairing.display_id)
    .maybeSingle();

  if (!display || !display.is_active) {
    return NextResponse.json({ error: "display_inactive" }, { status: 403 });
  }

  const { data: restaurant } = await admin
    .from("restaurants")
    .select("id, name, slug, brand_accent_hex")
    .eq("id", display.restaurant_id)
    .maybeSingle();

  if (!restaurant) {
    return NextResponse.json({ error: "restaurant_not_found" }, { status: 404 });
  }

  const deviceToken = generateDisplayToken();
  const deviceHash = hashDisplayToken(deviceToken);

  const { error: updateError } = await admin
    .from("restaurant_displays")
    .update({ device_secret_hash: deviceHash })
    .eq("id", display.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  await admin
    .from("restaurant_display_pairing_codes")
    .delete()
    .eq("display_id", display.id);

  const cookieStore = await cookies();
  cookieStore.set(
    DISPLAY_DEVICE_COOKIE,
    formatDisplayDeviceCookie(display.id as string, deviceToken),
    {
      ...displayCookieOptions,
      maxAge: 60 * 60 * 24 * 365,
    },
  );

  return NextResponse.json({
    ok: true,
    display: {
      id: display.id,
      name: display.name,
      allowed_modules: display.allowed_modules,
      auto_lock_seconds: display.auto_lock_seconds,
    },
    restaurant: {
      id: restaurant.id,
      name: restaurant.name,
      slug: restaurant.slug,
      accent_hex: restaurant.brand_accent_hex,
    },
  });
}
