import { parseMultipartSend } from "@/lib/contact-messages/parse-multipart-send";
import {
  parseOutboundAttachmentFiles,
  type OutboundAttachmentFile,
} from "@/lib/contact-messages/outbound-attachment-files";
import { sendEmailInboxMessageServer } from "@/lib/contact-messages/send-email-inbox-server";
import { isEmailPseudoContactId } from "@/lib/contact-messages/email-pseudo-contact";
import { authorizeContactMessagesRestaurant } from "@/lib/contact-messages/route-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let restaurantId = "";
  let messageBody = "";
  let emailContactId = "";
  let contactId = "";
  let restaurantName: string | null = null;
  let storeUnderContact = true;
  let attachmentFiles: OutboundAttachmentFile[] = [];

  const multipart = await parseMultipartSend(req);
  if (multipart) {
    const parsedFiles = await parseOutboundAttachmentFiles(multipart.files);
    if (!parsedFiles.ok) {
      return Response.json({ error: parsedFiles.error }, { status: 400 });
    }
    attachmentFiles = parsedFiles.files;
    restaurantId = multipart.fields.restaurantId?.trim() ?? "";
    messageBody = multipart.messageBody;
    emailContactId = multipart.fields.emailContactId?.trim() ?? "";
    contactId = multipart.fields.contactId?.trim() ?? "";
    restaurantName = multipart.fields.restaurantName?.trim() || null;
    storeUnderContact = multipart.fields.storeUnderContact !== "false";
  } else {
    const body = (await req.json().catch(() => ({}))) as {
      restaurantId?: string;
      emailContactId?: string;
      contactId?: string;
      messageBody?: string;
      restaurantName?: string | null;
      storeUnderContact?: boolean;
    };
    restaurantId = body.restaurantId?.trim() ?? "";
    messageBody = body.messageBody?.trim() ?? "";
    emailContactId = body.emailContactId?.trim() ?? "";
    contactId = body.contactId?.trim() ?? "";
    restaurantName = body.restaurantName?.trim() || null;
    storeUnderContact = body.storeUnderContact !== false;
  }

  if (
    !isUuidRestaurantId(restaurantId) ||
    (!messageBody && attachmentFiles.length === 0)
  ) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const auth = await authorizeContactMessagesRestaurant(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  let targetId = "";
  if (isUuidRestaurantId(contactId)) {
    const { data: contact } = await auth.supabase
      .from("contacts")
      .select("id")
      .eq("id", contactId)
      .eq("restaurant_id", restaurantId)
      .maybeSingle();
    if (!contact) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }
    targetId = contactId;
  } else if (isEmailPseudoContactId(emailContactId)) {
    targetId = emailContactId;
  } else {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const result = await sendEmailInboxMessageServer(admin, {
    restaurantId,
    contactId: targetId,
    body: messageBody,
    sentBy: auth.userId,
    restaurantName,
    // UUID-Kontakt und email:-Pseudo-Thread: ausgehend in Nachrichten speichern.
    storeUnderContact,
    attachmentFiles,
  });

  return Response.json(result);
}
