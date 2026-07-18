import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  setProfileNewsletterSubscribed,
  upsertNewsletterSubscriber,
} from "@/lib/supabase/platform-newsletter-db";
import { normalizeAppLocale } from "@/i18n/config";

export const dynamic = "force-dynamic";

export async function GET() {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: profile } = await sb
    .from("profiles")
    .select("newsletter_subscribed, locale, notification_email")
    .eq("id", user.id)
    .maybeSingle();

  return Response.json({
    subscribed: Boolean(profile?.newsletter_subscribed),
    locale: profile?.locale ?? null,
    email: profile?.notification_email || user.email || null,
  });
}

export async function PUT(req: Request) {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { subscribed?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  if (typeof body.subscribed !== "boolean") {
    return Response.json({ error: "subscribed_required" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("locale, notification_email")
    .eq("id", user.id)
    .maybeSingle();

  const email =
    (typeof profile?.notification_email === "string" &&
      profile.notification_email.trim()) ||
    user.email;
  if (!email) {
    return Response.json({ error: "email_required" }, { status: 400 });
  }

  try {
    await upsertNewsletterSubscriber({
      admin,
      email,
      profileId: user.id,
      locale: normalizeAppLocale(
        typeof profile?.locale === "string" ? profile.locale : "de",
      ),
      optedIn: body.subscribed,
    });
    await setProfileNewsletterSubscribed(admin, user.id, body.subscribed);
    return Response.json({ ok: true, subscribed: body.subscribed });
  } catch (e) {
    const message = e instanceof Error ? e.message : "save_failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
