import { NextResponse } from "next/server";
import {
  APP_LOCALE_COOKIE,
  APP_LOCALE_COOKIE_MAX_AGE_SECONDS,
  appLocaleToProfileLocale,
  isAppLocale,
  normalizeAppLocale,
} from "@/i18n/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function localeSetCookieHeader(locale: string): string {
  const parts = [
    `${APP_LOCALE_COOKIE}=${encodeURIComponent(locale)}`,
    "Path=/",
    `Max-Age=${APP_LOCALE_COOKIE_MAX_AGE_SECONDS}`,
    "SameSite=Lax",
  ];
  // iOS PWA / Safari: Secure auf HTTPS, sonst oft nicht persistent.
  if (process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }
  return parts.join("; ");
}

export async function PUT(req: Request) {
  let body: { locale?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const raw = typeof body.locale === "string" ? body.locale.trim() : "";
  const primary = raw.toLowerCase().split("-")[0] ?? "";
  if (!raw || (!isAppLocale(raw) && !isAppLocale(primary))) {
    return NextResponse.json({ error: "invalid_locale" }, { status: 400 });
  }
  const locale = normalizeAppLocale(raw);

  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { error } = await sb
    .from("profiles")
    .update({ locale: appLocaleToProfileLocale(locale) })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const res = NextResponse.json({ data: { locale } });
  res.headers.append("Set-Cookie", localeSetCookieHeader(locale));
  return res;
}
