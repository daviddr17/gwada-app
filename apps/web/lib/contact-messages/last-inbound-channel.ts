import type { ContactMessagePlatform } from "@/lib/constants/contact-message-platforms";
import { messageDisplayPlatform } from "@/lib/contact-messages/message-display-platform";
import type { ContactMessageRow } from "@/lib/supabase/contact-messages-db";

export type ReplyChannel =
  | "gwada"
  | "whatsapp"
  | "email"
  | "facebook"
  | "instagram";

/** Letzter Kanal, über den der Gast geschrieben hat (für Antwort-Default). */
export function lastInboundReplyChannel(
  messages: ContactMessageRow[],
): ReplyChannel {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.direction !== "inbound") continue;
    const p = messageDisplayPlatform(m);
    if (
      p === "whatsapp" ||
      p === "email" ||
      p === "gwada" ||
      p === "facebook" ||
      p === "instagram"
    ) {
      return p;
    }
  }
  return "gwada";
}

/** Posteingang: Standard-Schalter für externe Kanäle (mehrfach wählbar). */
export function inboxReplySendDefaults(
  messages: ContactMessageRow[],
  opts: {
    canWhatsapp: boolean;
    canEmail: boolean;
    canFacebook: boolean;
    canInstagram: boolean;
  },
): {
  whatsapp: boolean;
  email: boolean;
  facebook: boolean;
  instagram: boolean;
} {
  const none = {
    whatsapp: false,
    email: false,
    facebook: false,
    instagram: false,
  };
  const last = lastInboundReplyChannel(messages);
  if (last === "whatsapp") {
    return { ...none, whatsapp: opts.canWhatsapp };
  }
  if (last === "email") {
    return { ...none, email: opts.canEmail };
  }
  if (last === "facebook") {
    return { ...none, facebook: opts.canFacebook };
  }
  if (last === "instagram") {
    return { ...none, instagram: opts.canInstagram };
  }
  if (last === "gwada") {
    if (opts.canWhatsapp) return { ...none, whatsapp: true };
    if (opts.canEmail) return { ...none, email: true };
    if (opts.canFacebook) return { ...none, facebook: true };
    if (opts.canInstagram) return { ...none, instagram: true };
    return none;
  }
  return { ...none, whatsapp: opts.canWhatsapp };
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
