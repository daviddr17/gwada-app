import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { loadDisplayDevice } from "@/lib/display/display-auth-server";
import {
  DISPLAY_DEVICE_COOKIE,
  displayCookieOptions,
  formatDisplayDeviceCookie,
} from "@/lib/display/display-cookies";
import { findDisplayIdForInstallationCredentials } from "@/lib/display/display-installation-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 503 });
  }

  let body: {
    display_id?: string;
    installation_id?: string;
    device_token?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const displayId = body.display_id?.trim();
  const installationId = body.installation_id?.trim();
  const deviceToken = body.device_token?.trim();

  if (!displayId || !installationId || !deviceToken) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const display = await loadDisplayDevice(displayId);
  if (!display || !display.is_active) {
    return NextResponse.json({ error: "display_inactive" }, { status: 403 });
  }

  const valid = await findDisplayIdForInstallationCredentials({
    displayId,
    installationId,
    token: deviceToken,
  });

  if (!valid) {
    return NextResponse.json({ error: "credentials_invalid" }, { status: 403 });
  }

  const cookieStore = await cookies();
  cookieStore.set(
    DISPLAY_DEVICE_COOKIE,
    formatDisplayDeviceCookie(displayId, deviceToken),
    {
      ...displayCookieOptions,
      maxAge: 60 * 60 * 24 * 365,
    },
  );

  return NextResponse.json({ ok: true });
}
