import { Suspense } from "react";
import { ContactsMessagesScreen } from "@/components/contacts/contacts-messages-screen";

export default function KontakteNachrichtenPage() {
  return (
    <Suspense fallback={null}>
      <ContactsMessagesScreen />
    </Suspense>
  );
}
