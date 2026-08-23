import {
  isBareWhatsAppPlaceholderName,
  isWhatsAppJidOrRawNumberLabel,
} from "@/lib/contact-messages/waha-chat-label";
import { contactThreadAvatarInitials } from "@/lib/contacts/contact-thread-avatar-initials";
import type { ContactConversationPreview } from "@/lib/supabase/contact-messages-db";

function isPhoneLikeListLabel(name: string): boolean {
  const t = name.trim();
  if (!t) return false;
  if (t.startsWith("+")) return true;
  return isWhatsAppJidOrRawNumberLabel(t) || isBareWhatsAppPlaceholderName(t);
}

/** Listen-Avatar: Initialen aus Kontaktname — keine Telefon-Endziffern im Kreis. */
export function inboxConversationAvatarInitials(
  displayName: string,
  preview?: Pick<
    ContactConversationPreview,
    "contact_first_name" | "contact_last_name"
  >,
): string {
  const first = preview?.contact_first_name?.trim() ?? "";
  const last = preview?.contact_last_name?.trim() ?? "";
  if (first || last) {
    return contactThreadAvatarInitials({
      displayName: displayName.trim() || `${first} ${last}`.trim(),
      firstName: first,
      lastName: last,
    });
  }

  const trimmed = displayName.trim();
  if (!trimmed) return "?";

  if (isPhoneLikeListLabel(trimmed)) {
    return "☎";
  }

  return contactThreadAvatarInitials({ displayName: trimmed });
}

export function inboxConversationAvatarUrl(
  preview: Pick<ContactConversationPreview, "avatar_url">,
): string | null {
  const url = preview.avatar_url?.trim();
  return url || null;
}
