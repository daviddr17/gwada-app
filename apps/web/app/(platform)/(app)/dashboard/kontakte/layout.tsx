"use client";

import { usePathname } from "next/navigation";
import { AppMain } from "@/components/layout/app-main";
import { MESSAGES_MODULE_NAV } from "@/components/contacts/messages-module-nav";
import { RegisterModuleChrome } from "@/lib/contexts/app-module-chrome-context";
import { isModuleHomePath } from "@/lib/navigation/module-home-keep-alive";

export default function KontakteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  // Nachrichten-Inbox: Keep-alive unter App-Shell besitzt Chrome + Inhalt.
  if (isModuleHomePath(pathname, "nachrichten")) {
    return null;
  }

  return (
    <>
      <RegisterModuleChrome
        title="Nachrichten"
        subnavAriaLabel="Nachrichten-Bereiche"
        subnavItems={MESSAGES_MODULE_NAV}
      />
      <AppMain>{children}</AppMain>
    </>
  );
}
