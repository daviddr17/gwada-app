import "server-only";

import { storeGwadaMessageAttachments } from "@/lib/contact-messages/gwada-message-attachments-server";
import type { OutboundAttachmentFile } from "@/lib/contact-messages/outbound-attachment-files";
import {
  finalizeOutboundWhatsappMessage,
  insertPendingOutboundWhatsappMessage,
} from "@/lib/contact-messages/outbound-whatsapp-db-server";
import {
  sendWhatsappAttachmentFiles,
  sendWhatsappVoiceNote,
} from "@/lib/contact-messages/send-channel-attachments";
import { wahaChatIdFromPseudoContactId } from "@/lib/contact-messages/whatsapp-pseudo-contact";
import { wahaSendText } from "@/lib/whatsapp/waha-send-text";
import { wahaGetSession } from "@/lib/waha/waha-client";
import { getWahaServerConfigForRestaurantAdmin } from "@/lib/waha/waha-config";
import { wahaSessionNameForRestaurant } from "@/lib/waha/waha-session-name";
import type { SupabaseClient } from "@supabase/supabase-js";

async function isWhatsappSessionWorking(restaurantId: string): Promise<boolean> {
  const config = await getWahaServerConfigForRestaurantAdmin(restaurantId);
  if (!config) return false;
  const name = wahaSessionNameForRestaurant(restaurantId);
  const res = await wahaGetSession(config, name);
  return res.ok && res.data?.status === "WORKING";
}

function mirrorBodyForVoiceOrMedia(params: {
  text: string;
  voiceFile?: OutboundAttachmentFile;
  files?: OutboundAttachmentFile[];
}): string {
  const text = params.text.trim();
  if (text) return text;
  if (params.voiceFile) return "Sprachnachricht";
  if (params.files?.length) return " ";
  return " ";
}

export async function sendWahaMessageServer(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    wahaContactId: string;
    body: string;
    sentBy?: string | null;
    clientSendId?: string;
    attachmentFiles?: OutboundAttachmentFile[];
    voiceFile?: OutboundAttachmentFile;
  },
): Promise<{
  ok: boolean;
  errors: string[];
  messageId?: string;
  clientSendId?: string;
  wahaMessageId?: string | null;
}> {
  const text = params.body.trim();
  const files = params.attachmentFiles ?? [];
  const voiceFile = params.voiceFile;
  if (!text && files.length === 0 && !voiceFile) {
    return { ok: false, errors: ["empty_body"] };
  }

  const chatId = wahaChatIdFromPseudoContactId(params.wahaContactId);
  if (!chatId) return { ok: false, errors: ["invalid_waha_contact"] };

  if (!(await isWhatsappSessionWorking(params.restaurantId))) {
    return { ok: false, errors: ["whatsapp:session_not_working"] };
  }

  const mirrorBody = mirrorBodyForVoiceOrMedia({ text, voiceFile, files });
  const pending = await insertPendingOutboundWhatsappMessage(admin, {
    restaurantId: params.restaurantId,
    threadContactId: params.wahaContactId,
    body: mirrorBody,
    sentBy: params.sentBy ?? null,
    clientSendId: params.clientSendId,
    deliveryStatus: "pending",
  });

  if (!pending.ok) {
    return { ok: false, errors: [`whatsapp_db:${pending.error}`] };
  }

  const { messageId, clientSendId } = pending;

  if (files.length > 0) {
    const stored = await storeGwadaMessageAttachments(admin, {
      restaurantId: params.restaurantId,
      messageId,
      files,
    });
    if (stored.error) {
      await finalizeOutboundWhatsappMessage(admin, {
        restaurantId: params.restaurantId,
        messageId,
        deliveryStatus: "failed",
      });
      return { ok: false, errors: [`whatsapp_attachments:${stored.error}`] };
    }
  }

  let wahaMessageId: string | null = null;

  if (voiceFile) {
    const sent = await sendWhatsappVoiceNote({
      restaurantId: params.restaurantId,
      chatId,
      file: voiceFile,
    });
    if (!sent.ok) {
      await finalizeOutboundWhatsappMessage(admin, {
        restaurantId: params.restaurantId,
        messageId,
        deliveryStatus: "failed",
      });
      return {
        ok: false,
        errors: [`whatsapp:${sent.error}`],
        messageId,
        clientSendId,
      };
    }
  } else if (files.length > 0) {
    const sent = await sendWhatsappAttachmentFiles({
      restaurantId: params.restaurantId,
      chatId,
      files,
      caption: text || undefined,
    });
    if (!sent.ok) {
      await finalizeOutboundWhatsappMessage(admin, {
        restaurantId: params.restaurantId,
        messageId,
        deliveryStatus: "failed",
      });
      return {
        ok: false,
        errors: sent.errors,
        messageId,
        clientSendId,
      };
    }
  } else {
    const sent = await wahaSendText({
      restaurantId: params.restaurantId,
      chatId,
      text,
    });
    if (!sent.ok) {
      await finalizeOutboundWhatsappMessage(admin, {
        restaurantId: params.restaurantId,
        messageId,
        deliveryStatus: "failed",
      });
      return {
        ok: false,
        errors: [`whatsapp:${sent.error}`],
        messageId,
        clientSendId,
      };
    }
    wahaMessageId = sent.wahaMessageId ?? null;
  }

  await finalizeOutboundWhatsappMessage(admin, {
    restaurantId: params.restaurantId,
    messageId,
    deliveryStatus: "sent",
    wahaMessageId,
  });

  return { ok: true, errors: [], messageId, clientSendId, wahaMessageId };
}
