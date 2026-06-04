import { Suspense } from "react";
import { PublicContactGuestChat } from "@/components/contacts/public-contact-guest-chat";

export default function GuestContactChatPage() {
  return (
    <Suspense
      fallback={
        <p className="p-8 text-center text-sm text-muted-foreground">
          Chat wird geladen …
        </p>
      }
    >
      <PublicContactGuestChat />
    </Suspense>
  );
}
