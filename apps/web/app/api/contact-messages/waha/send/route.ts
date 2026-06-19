import { parseMultipartSend } from "@/lib/contact-messages/parse-multipart-send";
import {
  parseOutboundAttachmentFiles,
  parseOutboundVoiceFile,
  type OutboundAttachmentFile,
} from "@/lib/contact-messages/outbound-attachment-files";
import { sendWahaMessageServer } from "@/lib/contact-messages/send-waha-message-server";
import { isWahaPseudoContactId } from "@/lib/contact-messages/whatsapp-pseudo-contact";
import { authorizeContactMessagesRestaurant } from "@/lib/contact-messages/route-auth";
import { sendContactMessageServer } from "@/lib/contact-messages/send-contact-message-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let restaurantId = "";
  let messageBody = "";
  let wahaContactId = "";
  let contactId = "";
  let storeUnderContact = true;
  let attachmentFiles: OutboundAttachmentFile[] = [];
  let voiceFile: OutboundAttachmentFile | undefined;

  let clientSendId = "";

  const multipart = await parseMultipartSend(req);
  if (multipart) {
    const parsedFiles = await parseOutboundAttachmentFiles(multipart.files);
    if (!parsedFiles.ok) {
      return Response.json({ error: parsedFiles.error }, { status: 400 });
    }
    attachmentFiles = parsedFiles.files;
    if (multipart.voiceNote) {
      const parsedVoice = await parseOutboundVoiceFile(multipart.voiceNote);
      if (!parsedVoice.ok) {
        return Response.json({ error: parsedVoice.error }, { status: 400 });
      }
      voiceFile = parsedVoice.file;
    }
    restaurantId = multipart.fields.restaurantId?.trim() ?? "";
    messageBody = multipart.messageBody;
    wahaContactId = multipart.fields.wahaContactId?.trim() ?? "";
    contactId = multipart.fields.contactId?.trim() ?? "";
    storeUnderContact = multipart.fields.storeUnderContact !== "false";
    clientSendId = multipart.fields.clientSendId?.trim() ?? "";
  } else {
    const body = (await req.json().catch(() => ({}))) as {
      restaurantId?: string;
      wahaContactId?: string;
      contactId?: string;
      messageBody?: string;
      storeUnderContact?: boolean;
      clientSendId?: string;
    };
    restaurantId = body.restaurantId?.trim() ?? "";
    messageBody = body.messageBody?.trim() ?? "";
    wahaContactId = body.wahaContactId?.trim() ?? "";
    contactId = body.contactId?.trim() ?? "";
    storeUnderContact = body.storeUnderContact !== false;
    clientSendId = body.clientSendId?.trim() ?? "";
  }

  if (
    !isUuidRestaurantId(restaurantId) ||
    (!messageBody && attachmentFiles.length === 0 && !voiceFile)
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

  if (isUuidRestaurantId(contactId) && storeUnderContact) {
    const { data: contact } = await auth.supabase
      .from("contacts")
      .select("id")
      .eq("id", contactId)
      .eq("restaurant_id", restaurantId)
      .maybeSingle();

    if (!contact) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }

    const result = await sendContactMessageServer(admin, {
      restaurantId,
      contactId,
      body: messageBody,
      direction: "outbound",
      channels: ["whatsapp"],
      sentBy: auth.userId,
      attachmentFiles,
      voiceFile,
    });
    return Response.json(result);
  }

  if (!isWahaPseudoContactId(wahaContactId)) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const result = await sendWahaMessageServer(admin, {
    restaurantId,
    wahaContactId,
    body: messageBody,
    sentBy: auth.userId,
    clientSendId: clientSendId || undefined,
    attachmentFiles,
    voiceFile,
  });

  return Response.json(result);
}
