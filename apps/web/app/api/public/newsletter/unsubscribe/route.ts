import {
  getSubscriberByUnsubscribeToken,
  setProfileNewsletterSubscribed,
  upsertNewsletterSubscriber,
} from "@/lib/supabase/platform-newsletter-db";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { token?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  const token = body.token?.trim() ?? "";
  if (!token || token === "preview") {
    return Response.json({ error: "invalid_token" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  try {
    const sub = await getSubscriberByUnsubscribeToken(admin, token);
    if (!sub) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }
    await upsertNewsletterSubscriber({
      admin,
      email: sub.email,
      profileId: sub.profileId,
      optedIn: false,
    });
    if (sub.profileId) {
      await setProfileNewsletterSubscribed(admin, sub.profileId, false);
    }
    return Response.json({ ok: true, email: sub.email });
  } catch (e) {
    const message = e instanceof Error ? e.message : "unsubscribe_failed";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token")?.trim() ?? "";
  if (!token || token === "preview") {
    return Response.json({ error: "invalid_token" }, { status: 400 });
  }
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }
  try {
    const sub = await getSubscriberByUnsubscribeToken(admin, token);
    if (!sub) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }
    return Response.json({
      email: sub.email,
      optedIn: sub.optedIn,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "lookup_failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
