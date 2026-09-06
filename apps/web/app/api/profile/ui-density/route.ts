import { NextResponse } from "next/server";
import {
  DEFAULT_UI_DENSITY,
  isUiDensity,
  normalizeUiDensity,
  UI_DENSITY_COOKIE,
  UI_DENSITY_COOKIE_MAX_AGE_SECONDS,
  type UiDensity,
} from "@/lib/ui/ui-density";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function densitySetCookieHeader(density: UiDensity): string {
  const parts = [
    `${UI_DENSITY_COOKIE}=${encodeURIComponent(density)}`,
    "Path=/",
    `Max-Age=${UI_DENSITY_COOKIE_MAX_AGE_SECONDS}`,
    "SameSite=Lax",
  ];
  if (process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }
  return parts.join("; ");
}

export async function GET() {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data, error } = await sb
    .from("profiles")
    .select("ui_density")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const density = normalizeUiDensity(
    typeof data?.ui_density === "string" ? data.ui_density : DEFAULT_UI_DENSITY,
  );
  const res = NextResponse.json({ data: { density } });
  res.headers.append("Set-Cookie", densitySetCookieHeader(density));
  return res;
}

export async function PUT(req: Request) {
  let body: { density?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const raw = typeof body.density === "string" ? body.density.trim() : "";
  if (!raw || !isUiDensity(raw)) {
    return NextResponse.json({ error: "invalid_density" }, { status: 400 });
  }
  const density = normalizeUiDensity(raw);

  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { error } = await sb
    .from("profiles")
    .update({ ui_density: density })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const res = NextResponse.json({ data: { density } });
  res.headers.append("Set-Cookie", densitySetCookieHeader(density));
  return res;
}
