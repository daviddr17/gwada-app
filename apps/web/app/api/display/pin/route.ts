import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  assertDisplayDeviceFromCookies,
  buildDisplayContext,
  endDisplaySession,
  generateDisplayToken,
  hashDisplayToken,
  loadOpenDisplaySession,
  touchDisplaySession,
} from "@/lib/display/display-auth-server";
import {
  DISPLAY_SESSION_COOKIE,
  displayCookieOptions,
  formatDisplaySessionCookie,
  parseDisplaySessionCookie,
} from "@/lib/display/display-cookies";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const cookieStore = await cookies();
  const deviceResult = await assertDisplayDeviceFromCookies(cookieStore);
  if (!deviceResult.ok) {
    return NextResponse.json({ error: deviceResult.error }, { status: deviceResult.status });
  }

  let body: { staff_id?: string; pin?: string };
  try {
    body = (await request.json()) as { staff_id?: string; pin?: string };
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const pin = body.pin?.trim();
  if (!pin || !/^[0-9]{4}$/.test(pin)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  let staffId: string | null = null;

  if (body.staff_id?.trim()) {
    const { data: valid } = await admin.rpc("verify_restaurant_staff_display_pin", {
      p_restaurant_id: deviceResult.display.restaurant_id,
      p_staff_id: body.staff_id.trim(),
      p_pin: pin,
    });
    if (valid) staffId = body.staff_id.trim();
  } else {
    const { data: resolved } = await admin.rpc(
      "resolve_restaurant_staff_by_display_pin",
      {
        p_restaurant_id: deviceResult.display.restaurant_id,
        p_pin: pin,
      },
    );
    staffId = (resolved as string | null) ?? null;
  }

  if (!staffId) {
    return NextResponse.json({ error: "pin_invalid" }, { status: 401 });
  }

  await admin
    .from("restaurant_display_sessions")
    .update({ ended_at: new Date().toISOString() })
    .eq("display_id", deviceResult.display.id)
    .is("ended_at", null);

  const sessionToken = generateDisplayToken();
  const sessionHash = hashDisplayToken(sessionToken);

  const { data: session, error } = await admin
    .from("restaurant_display_sessions")
    .insert({
      display_id: deviceResult.display.id,
      staff_id: staffId,
      restaurant_id: deviceResult.display.restaurant_id,
      session_token_hash: sessionHash,
    })
    .select("id")
    .single();

  if (error || !session) {
    return NextResponse.json({ error: error?.message ?? "session_failed" }, { status: 500 });
  }

  cookieStore.set(
    DISPLAY_SESSION_COOKIE,
    formatDisplaySessionCookie(session.id as string, sessionToken),
    {
      ...displayCookieOptions,
      maxAge: 60 * 60 * 24,
    },
  );

  const context = await buildDisplayContext(cookieStore);
  return NextResponse.json({ ok: true, context });
}

export async function DELETE() {
  const cookieStore = await cookies();
  const parsed = parseDisplaySessionCookie(
    cookieStore.get(DISPLAY_SESSION_COOKIE)?.value,
  );
  if (parsed) {
    await endDisplaySession(parsed.sessionId);
  }
  cookieStore.delete(DISPLAY_SESSION_COOKIE);
  return NextResponse.json({ ok: true });
}

export async function PATCH() {
  const cookieStore = await cookies();
  const parsed = parseDisplaySessionCookie(
    cookieStore.get(DISPLAY_SESSION_COOKIE)?.value,
  );
  if (!parsed) {
    return NextResponse.json({ error: "session_locked" }, { status: 401 });
  }
  const session = await loadOpenDisplaySession(parsed.sessionId);
  if (!session) {
    return NextResponse.json({ error: "session_locked" }, { status: 401 });
  }
  await touchDisplaySession(parsed.sessionId);
  return NextResponse.json({ ok: true });
}
