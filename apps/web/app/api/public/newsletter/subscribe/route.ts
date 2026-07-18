import { normalizeAppLocale } from "@/i18n/config";
import {
  setProfileNewsletterSubscribed,
  upsertNewsletterSubscriber,
} from "@/lib/supabase/platform-newsletter-db";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { findAuthUserIdByEmailAdmin } from "@/lib/auth/find-auth-user-by-email";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { email?: string; locale?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const email = body.email?.trim() ?? "";
  if (!email.includes("@")) {
    return Response.json({ error: "invalid_email" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  try {
    const profileId = await findAuthUserIdByEmailAdmin(admin, email);
    await upsertNewsletterSubscriber({
      admin,
      email,
      profileId,
      locale: normalizeAppLocale(body.locale),
      optedIn: true,
    });
    if (profileId) {
      await setProfileNewsletterSubscribed(admin, profileId, true);
    }
    return Response.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "subscribe_failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
