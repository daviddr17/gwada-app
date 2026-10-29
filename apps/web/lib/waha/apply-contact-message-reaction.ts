import type { ContactMessageReaction } from "@/lib/supabase/contact-messages-db";
import { dedupeContactMessageReactions } from "@/lib/waha/waha-message-reactions";

function reactionSenderKey(fromMe: boolean, senderId?: string): string {
  return `${fromMe}:${senderId ?? ""}`;
}

/** Merge one reaction event onto an existing list (last stand per sender). */
export function applyContactMessageReactionEvent(
  existing: ContactMessageReaction[] | null | undefined,
  event: {
    emoji: string;
    fromMe: boolean;
    senderId?: string;
  },
): ContactMessageReaction[] {
  const list = [...(existing ?? [])];
  const key = reactionSenderKey(event.fromMe, event.senderId);
  const idx = list.findIndex(
    (r) => reactionSenderKey(r.fromMe, r.senderId) === key,
  );
  const emoji = event.emoji.trim();

  if (!emoji) {
    if (idx >= 0) list.splice(idx, 1);
  } else if (idx >= 0) {
    list[idx] = {
      emoji,
      fromMe: event.fromMe,
      senderId: event.senderId,
    };
  } else {
    list.push({
      emoji,
      fromMe: event.fromMe,
      senderId: event.senderId,
    });
  }

  return dedupeContactMessageReactions(list);
}
