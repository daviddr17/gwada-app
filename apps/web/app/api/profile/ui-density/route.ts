import { NextResponse } from "next/server";
import {
  DEFAULT_UI_DENSITY,
  isMissingUiDensityColumnError,
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

function okDensityResponse(
  density: UiDensity,
  persisted: "db" | "cookie",
): NextResponse {
  const res = NextResponse.json({ data: { density, persisted } });
  res.headers.append("Set-Cookie", densitySetCookieHeader(density));
  return res;
}

/**
 * Lesen: DB wenn Spalte existiert, sonst Cookie — nie 4xx wegen fehlender Spalte.
 */
export async function GET(req: Request) {
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
    if (isMissingUiDensityColumnError(error)) {
      const cookieHeader = req.headers.get("cookie") ?? "";
      const match = cookieHeader
        .split(";")
        .map((p) => p.trim())
        .find((p) => p.startsWith(`${UI_DENSITY_COOKIE}=`));
      const fromCookie = match
        ? decodeURIComponent(match.slice(UI_DENSITY_COOKIE.length + 1))
        : null;
      return okDensityResponse(normalizeUiDensity(fromCookie), "cookie");
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const density = normalizeUiDensity(
    typeof data?.ui_density === "string" ? data.ui_density : DEFAULT_UI_DENSITY,
  );
  return okDensityResponse(density, "db");
}

/**
 * Speichern: DB wenn möglich; fehlt die Spalte → nur Cookie (kein Live-DB-Fehler).
 */
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
    if (isMissingUiDensityColumnError(error)) {
      // Migration noch nicht auf Live — Preference trotzdem lokal halten.
      return okDensityResponse(density, "cookie");
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return okDensityResponse(density, "db");
}
