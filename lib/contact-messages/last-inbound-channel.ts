import type { ContactMessagePlatform } from "@/lib/constants/contact-message-platforms";
import { messageDisplayPlatform } from "@/lib/contact-messages/message-display-platform";
import type { ContactMessageRow } from "@/lib/supabase/contact-messages-db";

export type ReplyChannel = "gwada" | "whatsapp" | "email";

/** Letzter Kanal, über den der Gast geschrieben hat (für Antwort-Default). */
export function lastInboundReplyChannel(
  messages: ContactMessageRow[],
): ReplyChannel {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.direction !== "inbound") continue;
    const p = messageDisplayPlatform(m);
    if (p === "whatsapp" || p === "email" || p === "gwada") return p;
  }
  return "gwada";
}

/** Posteingang: Standard-Schalter für externe Kanäle (mehrfach wählbar). */
export function inboxReplySendDefaults(
  messages: ContactMessageRow[],
  opts: { canWhatsapp: boolean; canEmail: boolean },
): { whatsapp: boolean; email: boolean } {
  const last = lastInboundReplyChannel(messages);
  if (last === "whatsapp") {
    return { whatsapp: opts.canWhatsapp, email: false };
  }
  if (last === "email") {
    return { whatsapp: false, email: opts.canEmail };
  }
  if (last === "gwada") {
    if (opts.canWhatsapp) return { whatsapp: true, email: false };
    if (opts.canEmail) return { whatsapp: false, email: true };
    return { whatsapp: false, email: false };
  }
  return { whatsapp: opts.canWhatsapp, email: false };
}

export function lastInboundPlatform(
  messages: ContactMessageRow[],
): ContactMessagePlatform | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.direction !== "inbound") continue;
    return messageDisplayPlatform(m);
  }
  return null;
}
