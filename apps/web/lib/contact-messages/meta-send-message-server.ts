import "server-only";

import { metaGraphPostJson, metaGraphPostMultipart } from "@/lib/contact-messages/meta-graph-client";
import { resolveMetaInboxAuth } from "@/lib/contact-messages/meta-inbox-auth-server";
import { parseMetaPseudoContactId } from "@/lib/contact-messages/meta-pseudo-contact";
import type { OutboundAttachmentFile } from "@/lib/contact-messages/outbound-attachment-files";
import { outboundAttachmentSendKind } from "@/lib/contact-messages/outbound-attachment-files";
import type { SupabaseClient } from "@supabase/supabase-js";

type MetaAttachmentType = "image" | "video" | "audio" | "file";

function metaAttachmentType(
  mime: string,
  kind: ReturnType<typeof outboundAttachmentSendKind>,
): MetaAttachmentType {
  if (kind === "image") return "image";
  if (kind === "video") return "video";
  if (kind === "voice") return "audio";
  return "file";
}

async function uploadMetaAttachment(params: {
  pageId: string;
  accessToken: string;
  type: MetaAttachmentType;
  file: OutboundAttachmentFile;
}): Promise<{ attachmentId: string | null; error: string | null }> {
  const message = JSON.stringify({
    attachment: {
      type: params.type,
      payload: { is_reusable: true },
    },
  });

  const res = await metaGraphPostMultipart<{ attachment_id?: string }>({
    path: `${params.pageId}/message_attachments`,
    accessToken: params.accessToken,
    fields: { message },
    fileFieldName: "filedata",
    fileName: params.file.fileName,
    mimeType: params.file.mimeType,
    bytes: params.file.bytes,
  });

  if (res.error) return { attachmentId: null, error: res.error };
  const attachmentId = res.data?.attachment_id?.trim();
  if (!attachmentId) return { attachmentId: null, error: "meta_upload_failed" };
  return { attachmentId, error: null };
}

async function sendMetaPayload(params: {
  rootId: string;
  accessToken: string;
  recipientId: string;
  message: Record<string, unknown>;
}): Promise<{ ok: boolean; error: string | null }> {
  const res = await metaGraphPostJson<{ message_id?: string }>({
    path: `${params.rootId}/messages`,
    accessToken: params.accessToken,
    body: {
      recipient: { id: params.recipientId },
      messaging_type: "RESPONSE",
      message: params.message,
    },
  });
  if (res.error) return { ok: false, error: res.error };
  return { ok: true, error: null };
}

export async function sendMetaMessageServer(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    metaContactId: string;
    body: string;
    attachmentFiles?: OutboundAttachmentFile[];
    voiceFile?: OutboundAttachmentFile;
  },
): Promise<{ ok: boolean; errors: string[] }> {
  const text = params.body.trim();
  const files = params.attachmentFiles ?? [];
  const voiceFile = params.voiceFile;
  if (!text && files.length === 0 && !voiceFile) {
    return { ok: false, errors: ["empty_body"] };
  }

  const parsed = parseMetaPseudoContactId(params.metaContactId);
  if (!parsed) return { ok: false, errors: ["invalid_meta_contact"] };

  const auth = await resolveMetaInboxAuth(
    admin,
    params.restaurantId,
    parsed.platform,
  );
  if (!auth) return { ok: false, errors: ["meta:meta_not_connected"] };

  const rootId = parsed.platform === "instagram" ? auth.igUserId! : auth.pageId;
  const prefix = parsed.platform;

  const sendAttachment = async (
    file: OutboundAttachmentFile,
    caption?: string,
  ): Promise<{ ok: boolean; error: string | null }> => {
    const kind = outboundAttachmentSendKind(file.mimeType);
    const type = metaAttachmentType(file.mimeType, kind);
    const uploaded = await uploadMetaAttachment({
      pageId: auth.pageId,
      accessToken: auth.pageAccessToken,
      type,
      file,
    });
    if (!uploaded.attachmentId) {
      return { ok: false, error: uploaded.error ?? "meta_upload_failed" };
    }

    const message: Record<string, unknown> = {
      attachment: {
        type,
        payload: { attachment_id: uploaded.attachmentId },
      },
    };
    if (caption) message.text = caption;

    const sent = await sendMetaPayload({
      rootId,
      accessToken: auth.pageAccessToken,
      recipientId: parsed.senderId,
      message,
    });
    return { ok: sent.ok, error: sent.error };
  };

  if (voiceFile) {
    const sent = await sendAttachment(voiceFile);
    return sent.ok
      ? { ok: true, errors: [] }
      : { ok: false, errors: [`${prefix}:${sent.error ?? "send_failed"}`] };
  }

  if (files.length > 0) {
    const errors: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const caption = i === 0 && text ? text : undefined;
      const sent = await sendAttachment(files[i]!, caption);
      if (!sent.ok) errors.push(`${prefix}:${sent.error ?? "send_failed"}`);
    }
    return errors.length ? { ok: false, errors } : { ok: true, errors: [] };
  }

  const sent = await sendMetaPayload({
    rootId,
    accessToken: auth.pageAccessToken,
    recipientId: parsed.senderId,
    message: { text },
  });

  if (!sent.ok) {
    return { ok: false, errors: [`${prefix}:${sent.error ?? "send_failed"}`] };
  }
  return { ok: true, errors: [] };
}
