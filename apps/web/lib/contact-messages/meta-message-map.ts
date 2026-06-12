import "server-only";

import type { ContactMessageReaction } from "@/lib/supabase/contact-messages-db";
import type { ContactMessageRow } from "@/lib/supabase/contact-messages-db";
import type { ContactMessageAttachment } from "@/lib/types/contact-message-attachment";

export type MetaGraphMessage = {
  id: string;
  message?: string;
  created_time?: string;
  from?: { id: string; name?: string };
  attachments?: {
    data?: Array<{
      id?: string;
      mime_type?: string;
      name?: string;
      file_url?: string;
      image_data?: { url?: string };
      video_data?: { url?: string };
    }>;
  };
  sticker?: string;
  reactions?: {
    data?: Array<{
      reaction?: string;
      emoji?: string;
      users?: { data?: Array<{ id: string }> };
    }>;
  };
};

const META_REACTION_TO_EMOJI: Record<string, string> = {
  like: "👍",
  love: "❤️",
  haha: "😂",
  wow: "😮",
  sad: "😢",
  sorry: "🙏",
  angry: "😠",
};

export function metaReactionEmoji(raw: string | undefined): string {
  if (!raw) return "👍";
  if (raw.length <= 4 && /\p{Extended_Pictographic}/u.test(raw)) return raw;
  return META_REACTION_TO_EMOJI[raw.toLowerCase()] ?? raw;
}

export function emojiToMetaReactionType(emoji: string): string {
  const map: Record<string, string> = {
    "👍": "like",
    "❤️": "love",
    "❤": "love",
    "😂": "haha",
    "😮": "wow",
    "😢": "sad",
    "🙏": "sorry",
    "😠": "angry",
  };
  return map[emoji] ?? emoji;
}

type MetaAttachmentRow = NonNullable<
  NonNullable<MetaGraphMessage["attachments"]>["data"]
>[number];

function attachmentFromMeta(
  att: MetaAttachmentRow,
  index: number,
): ContactMessageAttachment | null {
  const url =
    att.image_data?.url ??
    att.video_data?.url ??
    att.file_url ??
    null;
  if (!url) return null;

  const mime = (att.mime_type ?? "").toLowerCase();
  let kind: ContactMessageAttachment["kind"] = "file";
  if (mime.startsWith("image/") || att.image_data?.url) kind = "image";
  else if (mime.startsWith("video/") || att.video_data?.url) kind = "video";
  else if (mime.startsWith("audio/")) kind = "voice";

  return {
    id: att.id ?? String(index),
    kind,
    fileName: att.name?.trim() || (kind === "voice" ? "Sprachnachricht" : "Anhang"),
    mimeType: mime || "application/octet-stream",
    url,
  };
}

function reactionsFromMeta(
  msg: MetaGraphMessage,
  ownIds: Set<string>,
): ContactMessageReaction[] | undefined {
  const rows = msg.reactions?.data ?? [];
  if (!rows.length) return undefined;

  const out: ContactMessageReaction[] = [];
  for (const r of rows) {
    const emoji = metaReactionEmoji(r.emoji ?? r.reaction);
    const users = r.users?.data ?? [];
    if (users.length) {
      for (const u of users) {
        out.push({
          emoji,
          fromMe: ownIds.has(u.id),
          senderId: u.id,
        });
      }
    } else {
      out.push({ emoji, fromMe: false });
    }
  }
  return out;
}

export function mapMetaGraphMessageToRow(params: {
  msg: MetaGraphMessage;
  restaurantId: string;
  contactId: string;
  platform: "facebook" | "instagram";
  ownIds: Set<string>;
}): ContactMessageRow | null {
  const { msg, ownIds } = params;
  const attachments = (msg.attachments?.data ?? [])
    .map((a, i) => attachmentFromMeta(a, i))
    .filter((a): a is ContactMessageAttachment => a != null);

  const text = msg.message?.trim() ?? "";
  const hasSticker = Boolean(msg.sticker);
  if (!text && attachments.length === 0 && !hasSticker) return null;

  const fromId = msg.from?.id ?? "";
  const inbound = !ownIds.has(fromId);
  const graphId = msg.id;

  return {
    id: `meta:${params.platform}:${graphId}`,
    restaurant_id: params.restaurantId,
    contact_id: params.contactId,
    platform: params.platform,
    direction: inbound ? "inbound" : "outbound",
    body: text || (hasSticker ? "Sticker" : attachments[0]?.fileName ?? ""),
    reservation_id: null,
    sent_by: null,
    delivery_status: "delivered",
    created_at: msg.created_time ?? new Date().toISOString(),
    external_source_id: graphId,
    meta_message_id: graphId,
    reactions: reactionsFromMeta(msg, ownIds),
    attachments: attachments.length ? attachments : undefined,
  };
}
