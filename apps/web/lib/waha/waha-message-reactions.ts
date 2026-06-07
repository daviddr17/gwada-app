import type { WahaChatMessage } from "@/lib/waha/waha-inbox";
import type { ContactMessageReaction } from "@/lib/supabase/contact-messages-db";

function reactionSenderKey(fromMe: boolean, senderId?: string): string {
  return `${fromMe}:${senderId ?? ""}`;
}

/** Reactions aus NOWEB/GOWS `_data.reactions` oder vergleichbaren Feldern. */
export function parseReactionsFromWahaMessage(
  message: WahaChatMessage,
): ContactMessageReaction[] {
  const out: ContactMessageReaction[] = [];
  const data = message._data;
  if (!data || typeof data !== "object") return out;

  const raw = (data as Record<string, unknown>).reactions;
  if (!Array.isArray(raw)) return out;

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const text = typeof row.text === "string" ? row.text.trim() : "";
    if (!text) continue;
    const key = row.key as
      | { fromMe?: boolean; participant?: string; remoteJid?: string }
      | undefined;
    const senderId =
      typeof key?.participant === "string"
        ? key.participant
        : typeof key?.remoteJid === "string"
          ? key.remoteJid
          : undefined;
    out.push({
      emoji: text,
      fromMe: Boolean(key?.fromMe),
      senderId,
    });
  }

  return dedupeContactMessageReactions(out);
}

/** Einzelne Reaction-Nachricht (Webhook / Verlauf), nicht als Bubble anzeigen. */
export function isWahaReactionEventMessage(message: WahaChatMessage): boolean {
  if (message.reaction?.messageId) return true;
  const data = message._data;
  if (data && typeof data === "object") {
    const inner = (data as Record<string, unknown>).message;
    if (inner && typeof inner === "object" && "reactionMessage" in inner) {
      return true;
    }
  }
  return false;
}

/** Reaction-Event auf Zielnachricht anwenden (letzter Stand pro Absender). */
export function applyWahaReactionEvent(
  event: WahaChatMessage,
  reactionsByMessageId: Map<string, ContactMessageReaction[]>,
): void {
  const targetId = event.reaction?.messageId?.trim();
  if (!targetId) return;

  const emoji = (event.reaction?.text ?? "").trim();
  const list = [...(reactionsByMessageId.get(targetId) ?? [])];
  const senderId = event.from ?? event.participant ?? undefined;
  const fromMe = Boolean(event.fromMe);
  const key = reactionSenderKey(fromMe, senderId);
  const idx = list.findIndex(
    (r) => reactionSenderKey(r.fromMe, r.senderId) === key,
  );

  if (!emoji) {
    if (idx >= 0) list.splice(idx, 1);
  } else if (idx >= 0) {
    list[idx] = { emoji, fromMe, senderId };
  } else {
    list.push({ emoji, fromMe, senderId });
  }

  if (list.length > 0) {
    reactionsByMessageId.set(targetId, dedupeContactMessageReactions(list));
  } else {
    reactionsByMessageId.delete(targetId);
  }
}

export function dedupeContactMessageReactions(
  reactions: ContactMessageReaction[],
): ContactMessageReaction[] {
  const map = new Map<string, ContactMessageReaction>();
  for (const r of reactions) {
    map.set(reactionSenderKey(r.fromMe, r.senderId), r);
  }
  return [...map.values()];
}

export function mergeReactionsOntoRow(
  wahaMessageId: string,
  base: ContactMessageReaction[] | undefined,
  reactionsByMessageId: Map<string, ContactMessageReaction[]>,
): ContactMessageReaction[] | undefined {
  const fromEvents = reactionsByMessageId.get(wahaMessageId);
  const merged = dedupeContactMessageReactions([
    ...(base ?? []),
    ...(fromEvents ?? []),
  ]);
  return merged.length > 0 ? merged : undefined;
}
