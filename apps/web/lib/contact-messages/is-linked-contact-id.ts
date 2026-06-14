import { isEmailPseudoContactId } from "@/lib/contact-messages/email-pseudo-contact";
import { isMetaPseudoContactId } from "@/lib/contact-messages/meta-pseudo-contact";
import { isWahaPseudoContactId } from "@/lib/contact-messages/whatsapp-pseudo-contact";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

/** Verknüpfter Gwada-Kontakt in der DB (kein Inbox-Pseudo-Chat). */
export function isLinkedContactId(contactId: string): boolean {
  return (
    isUuidRestaurantId(contactId) &&
    !isWahaPseudoContactId(contactId) &&
    !isEmailPseudoContactId(contactId) &&
    !isMetaPseudoContactId(contactId)
  );
}
