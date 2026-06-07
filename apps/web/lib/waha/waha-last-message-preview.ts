import {
  parseWahaMessageMedia,
  wahaMediaPreviewLabel,
} from "@/lib/contact-messages/waha-message-media";
import type { ContactMessageAttachmentKind } from "@/lib/types/contact-message-attachment";
import type { WahaChatMessage } from "@/lib/waha/waha-inbox";

/** Vorschau-Text für WAHA chats/overview `lastMessage` (inkl. Reactions). */

export type WahaLastMessageLike = {
  body?: string | null;
  fromMe?: boolean | null;
  hasMedia?: boolean;
  media?: WahaChatMessage["media"];
  type?: string;
  reaction?: {
    text?: string | null;
    messageId?: string | null;
  } | null;
  _data?: Record<string, unknown> | null;
};

function reactionEmojiFromData(
  data: Record<string, unknown> | null | undefined,
): string {
  if (!data) return "";
  const message = data.message;
  if (!message || typeof message !== "object") return "";

  const reactionMessage = (message as Record<string, unknown>).reactionMessage;
  if (!reactionMessage || typeof reactionMessage !== "object") return "";

  const textNode = (reactionMessage as Record<string, unknown>).text;
  if (!textNode || typeof textNode !== "object") return "";

  const emoji = (textNode as Record<string, unknown>).text;
  return typeof emoji === "string" ? emoji.trim() : "";
}

export function wahaLastMessagePreview(last: WahaLastMessageLike | null | undefined): {
  text: string;
  isReaction: boolean;
  attachmentKind?: ContactMessageAttachmentKind;
} {
  if (!last) {
    return { text: "—", isReaction: false };
  }

  const topReaction = (last.reaction?.text ?? "").trim();
  if (topReaction) {
    return { text: topReaction, isReaction: true };
  }

  const dataReaction = reactionEmojiFromData(last._data ?? undefined);
  if (dataReaction) {
    return { text: dataReaction, isReaction: true };
  }

  const media = parseWahaMessageMedia(last as WahaChatMessage);
  const attachmentKind = media?.kind;

  const body = (last.body ?? "").trim();
  if (body) {
    return { text: body, isReaction: false, attachmentKind };
  }

  const mediaLabel = wahaMediaPreviewLabel(last as WahaChatMessage);
  if (mediaLabel) {
    return { text: mediaLabel, isReaction: false, attachmentKind };
  }

  return { text: "—", isReaction: false, attachmentKind };
}
