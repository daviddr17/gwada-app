import {
  loadPublicContactChatSession,
  loadPublicContactMessages,
  sendPublicContactMessage,
} from "@/lib/contacts/public-contact-messages-server";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export const dynamic = "force-dynamic";

function contactIdFromUrl(url: URL): string {
  return (
    url.searchParams.get("kontakt")?.trim() ??
    url.searchParams.get("contact")?.trim() ??
    ""
  );
}

export async function GET(req: Request) {
  const contactId = contactIdFromUrl(new URL(req.url));

  if (!isUuidRestaurantId(contactId)) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const session = await loadPublicContactChatSession(contactId);
  if (!session.data) {
    return Response.json(
      { error: session.error },
      { status: session.status },
    );
  }

  const result = await loadPublicContactMessages(contactId);
  if (!result.data) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  return Response.json({
    session: session.data,
    messages: result.data,
  });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    kontakt?: string;
    contact?: string;
    contactId?: string;
    messageBody?: string;
  };

  const contactId =
    body.kontakt?.trim() ??
    body.contact?.trim() ??
    body.contactId?.trim() ??
    "";
  const messageBody = body.messageBody?.trim() ?? "";

  if (!isUuidRestaurantId(contactId) || !messageBody) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const result = await sendPublicContactMessage(contactId, messageBody);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  return Response.json({ ok: true });
}
