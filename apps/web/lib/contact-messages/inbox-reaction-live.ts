import { applyContactMessageReactionEvent } from "@/lib/waha/apply-contact-message-reaction";
import type { ContactMessageReaction } from "@/lib/supabase/contact-messages-db";
import type { ContactMessageRow } from "@/lib/supabase/contact-messages-db";
import { patchMessageReactionsByWahaId } from "@/lib/contact-messages/optimistic-thread-messages";

export const GWADA_INBOX_REACTION_LIVE_EVENT = "gwada:inbox-reaction-live";

export type InboxReactionLiveDetail = {
  restaurantId: string;
  wahaMessageId: string;
  emoji: string;
  fromMe: boolean;
  senderId?: string | null;
};

export function dispatchInboxReactionLive(detail: InboxReactionLiveDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(GWADA_INBOX_REACTION_LIVE_EVENT, { detail }),
  );
}

export function applyInboxReactionLiveToMessages(
  messages: ContactMessageRow[],
  detail: Pick<
    InboxReactionLiveDetail,
    "wahaMessageId" | "emoji" | "fromMe" | "senderId"
  >,
): ContactMessageRow[] {
  const target = messages.find(
    (m) =>
      m.waha_message_id === detail.wahaMessageId ||
      m.external_source_id === `waha:${detail.wahaMessageId}`,
  );
  const nextReactions = applyContactMessageReactionEvent(
    target?.reactions as ContactMessageReaction[] | undefined,
    {
      emoji: detail.emoji,
      fromMe: detail.fromMe,
      senderId: detail.senderId ?? undefined,
    },
  );
  return patchMessageReactionsByWahaId(
    messages,
    detail.wahaMessageId,
    nextReactions,
  );
}
