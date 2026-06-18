import { CONTACT_MESSAGE_PLATFORM_LABELS } from "@/lib/constants/contact-message-platforms";
import { emailAddressFromPseudoContactId } from "@/lib/contact-messages/email-pseudo-contact";
import { isLinkedContactId } from "@/lib/contact-messages/is-linked-contact-id";
import {
  metaPlatformFromPseudoContactId,
} from "@/lib/contact-messages/meta-pseudo-contact";
import {
  isWahaPseudoContactId,
  wahaChatIdFromPseudoContactId,
} from "@/lib/contact-messages/whatsapp-pseudo-contact";
import { displayNameFromWahaChatId } from "@/lib/contact-messages/waha-chat-label";
import { isEmailPseudoContactId } from "@/lib/contact-messages/email-pseudo-contact";
import { isMetaPseudoContactId } from "@/lib/contact-messages/meta-pseudo-contact";

export type ConversationThreadRef = {
  /** URL/UI-Schlüssel — UUID oder Pseudo-ID. */
  threadKey: string;
  contactId: string | null;
  conversationKey: string | null;
};

export function resolveConversationThreadRef(
  threadKey: string,
): ConversationThreadRef {
  if (isLinkedContactId(threadKey)) {
    return { threadKey, contactId: threadKey, conversationKey: null };
  }
  if (
    isWahaPseudoContactId(threadKey) ||
    isEmailPseudoContactId(threadKey) ||
    isMetaPseudoContactId(threadKey)
  ) {
    return { threadKey, contactId: null, conversationKey: threadKey };
  }
  return { threadKey, contactId: null, conversationKey: null };
}

export function conversationThreadKeyFromRow(row: {
  contact_id?: string | null;
  conversation_key?: string | null;
}): string {
  return row.contact_id ?? row.conversation_key ?? "";
}

export function defaultConversationLabel(conversationKey: string): string {
  if (isWahaPseudoContactId(conversationKey)) {
    const chatId = wahaChatIdFromPseudoContactId(conversationKey);
    return (
      (chatId ? displayNameFromWahaChatId(chatId) : null) ??
      "WhatsApp"
    );
  }
  if (isEmailPseudoContactId(conversationKey)) {
    return emailAddressFromPseudoContactId(conversationKey) ?? "E-Mail";
  }
  const metaPlatform = metaPlatformFromPseudoContactId(conversationKey);
  if (metaPlatform) {
    return CONTACT_MESSAGE_PLATFORM_LABELS[metaPlatform];
  }
  return "Chat";
}
