"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContactMessagesDrawer } from "@/components/contacts/contact-messages-drawer";
import { contactDisplayName, type ContactDetail } from "@/lib/supabase/contacts-db";

const contactQuickActionButtonClassName =
  "h-8 gap-1 rounded-xl sm:flex-1 sm:min-w-0";

export function ContactQuickActionsBar({
  restaurantId,
  contact,
}: {
  restaurantId: string;
  contact: ContactDetail;
}) {
  const router = useRouter();
  const [messagesOpen, setMessagesOpen] = useState(false);

  const contactName = contactDisplayName(contact);

  return (
    <>
      <div className="flex flex-wrap gap-1.5 sm:flex-nowrap">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={contactQuickActionButtonClassName}
          onClick={() => setMessagesOpen(true)}
        >
          <MessageSquare className="size-3.5" />
          Nachricht senden
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={contactQuickActionButtonClassName}
          onClick={() =>
            router.push(
              `/dashboard/reservierungen/uebersicht?new=1&contact=${contact.id}`,
            )
          }
        >
          <CalendarPlus className="size-3.5" />
          Reservierung anlegen
        </Button>
      </div>

      <ContactMessagesDrawer
        open={messagesOpen}
        onOpenChange={setMessagesOpen}
        restaurantId={restaurantId}
        contactId={contact.id}
        contactName={contactName}
      />
    </>
  );
}
