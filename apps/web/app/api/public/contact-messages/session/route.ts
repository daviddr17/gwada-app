import {
  canResendGuestCode,
  issueGuestLoginCode,
  lastCodeSentAt,
  verifyGuestLoginCode,
} from "@/lib/contacts/guest-chat-auth-server";
import {
  loadPublicContactChatSession,
  setGuestSessionCookie,
} from "@/lib/contacts/public-contact-messages-server";
import { autoResendGuestAccessCode } from "@/lib/contacts/guest-access-auto-resend";
import { sendContactGuestChatNotifications } from "@/lib/contacts/contact-guest-notification-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export const dynamic = "force-dynamic";

function contactIdFromBody(body: Record<string, unknown>): string {
  return (
    (typeof body.kontakt === "string" ? body.kontakt : "") ||
    (typeof body.contactId === "string" ? body.contactId : "") ||
    ""
  ).trim();
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const contactId =
    url.searchParams.get("kontakt")?.trim() ??
    url.searchParams.get("contact")?.trim() ??
    "";

  if (!isUuidRestaurantId(contactId)) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const session = await loadPublicContactChatSession(contactId);
  if (!session.data) {
    return Response.json({ authenticated: false });
  }

  return Response.json({
    authenticated: true,
    session: session.data,
  });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const contactId = contactIdFromBody(body);
  const action =
    typeof body.action === "string" ? body.action.trim() : "verify";

  if (!isUuidRestaurantId(contactId)) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const { data: contact } = await admin
    .from("contacts")
    .select("restaurant_id")
    .eq("id", contactId)
    .maybeSingle();

  if (!contact) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const restaurantId = (contact as { restaurant_id: string }).restaurant_id;

  if (action === "auto_resend") {
    const result = await autoResendGuestAccessCode(admin, {
      restaurantId,
      contactId,
      restaurantName:
        typeof body.restaurantName === "string" ? body.restaurantName : null,
    });

    if (!result.ok) {
      return Response.json(
        {
          error: result.error,
          retryAfterMs: result.retryAfterMs,
        },
        { status: result.status },
      );
    }

    if (!result.sent) {
      return Response.json({
        ok: true,
        sent: false,
        reason: result.reason,
      });
    }

    return Response.json({
      ok: true,
      sent: true,
      channels: result.channels,
    });
  }

  if (action === "resend") {
    const last = await lastCodeSentAt(admin, contactId);
    if (!canResendGuestCode(last)) {
      return Response.json({ error: "resend_cooldown" }, { status: 429 });
    }

    const notifyWhatsapp = body.notifyWhatsapp === true;
    const notifyEmail = body.notifyEmail === true;
    const restaurantName =
      typeof body.restaurantName === "string" ? body.restaurantName : null;

    if (notifyWhatsapp || notifyEmail) {
      const result = await sendContactGuestChatNotifications(admin, {
        restaurantId,
        contactId,
        restaurantName,
        notifyWhatsapp,
        notifyEmail,
      });
      if (!result.ok) {
        return Response.json({ ok: false, errors: result.errors }, { status: 422 });
      }
      return Response.json({ ok: true, sent: true });
    }

    const issued = await issueGuestLoginCode(admin, { restaurantId, contactId });
    if (!issued) {
      return Response.json({ error: "issue_failed" }, { status: 500 });
    }

    return Response.json({
      ok: true,
      sent: false,
      message:
        "Neuer Code wurde erstellt. Versand nur bei aktivierter Benachrichtigung im Restaurant.",
    });
  }

  const code = typeof body.code === "string" ? body.code.trim() : "";
  const verified = await verifyGuestLoginCode(admin, {
    contactId,
    code,
    req,
  });

  if (!verified.ok) {
    return Response.json(
      { error: verified.error },
      { status: verified.status },
    );
  }

  const loaded = await loadPublicContactChatSession(contactId);
  const res = Response.json({
    ok: true,
    session: loaded.data ?? {
      contactId,
      restaurantId: verified.restaurantId,
    },
  });
  setGuestSessionCookie(
    res,
    verified.sessionId,
    verified.sessionToken,
    verified.expiresAt,
  );
  return res;
}
