"use client";

import { Suspense } from "react";
import { AppMain } from "@/components/layout/app-main";
import { ContactsMessagesScreen } from "@/components/contacts/contacts-messages-screen";
import { MESSAGES_MODULE_NAV } from "@/components/contacts/messages-module-nav";
import { RegisterModuleChrome } from "@/lib/contexts/app-module-chrome-context";

/** Keep-alive Host für Nachrichten-Inbox (Chrome nur wenn active). */
export function ContactsMessagesKeepAliveScreen({
  active,
}: {
  active: boolean;
}) {
  return (
    <>
      {active ? (
        <RegisterModuleChrome
          title="Nachrichten"
          subnavAriaLabel="Nachrichten-Bereiche"
          subnavItems={MESSAGES_MODULE_NAV}
        />
      ) : null}
      <AppMain>
        <Suspense fallback={null}>
          <ContactsMessagesScreen active={active} />
        </Suspense>
      </AppMain>
    </>
  );
}
