import { parseMultipartSend } from "@/lib/contact-messages/parse-multipart-send";
import {
  parseOutboundAttachmentFiles,
  parseOutboundVoiceFile,
  type OutboundAttachmentFile,
} from "@/lib/contact-messages/outbound-attachment-files";
import { isMetaPseudoContactId } from "@/lib/contact-messages/meta-pseudo-contact";
import { sendMetaMessageServer } from "@/lib/contact-messages/meta-send-message-server";
import { authorizeContactMessagesRestaurant } from "@/lib/contact-messages/route-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let restaurantId = "";
  let messageBody = "";
  let metaContactId = "";
  let attachmentFiles: OutboundAttachmentFile[] = [];
  let voiceFile: OutboundAttachmentFile | undefined;

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
    metaContactId = multipart.fields.metaContactId?.trim() ?? "";
  } else {
    const body = (await req.json().catch(() => ({}))) as {
      restaurantId?: string;
      metaContactId?: string;
      messageBody?: string;
    };
    restaurantId = body.restaurantId?.trim() ?? "";
    messageBody = body.messageBody?.trim() ?? "";
    metaContactId = body.metaContactId?.trim() ?? "";
  }

  if (
    !isUuidRestaurantId(restaurantId) ||
    (!messageBody && attachmentFiles.length === 0 && !voiceFile)
  ) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  if (!isMetaPseudoContactId(metaContactId)) {
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

  const result = await sendMetaMessageServer(admin, {
    restaurantId,
    metaContactId,
    body: messageBody,
    attachmentFiles,
    voiceFile,
  });

  return Response.json(result);
}
