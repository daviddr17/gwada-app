"use client";

import { Suspense } from "react";
import { AppMain } from "@/components/layout/app-main";
import { MENU_MODULE_NAV } from "@/components/menu/menu-module-nav";
import { MenuOverviewScreen } from "@/components/menu/menu-overview-screen";
import { RegisterModuleChrome } from "@/lib/contexts/app-module-chrome-context";

/** Keep-alive Host für Speisekarte-Übersicht. */
export function MenuOverviewKeepAliveScreen({
  active,
  showChrome = active,
}: {
  active: boolean;
  showChrome?: boolean;
}) {
  return (
    <>
      {showChrome ? (
        <RegisterModuleChrome
          title="Speisekarte"
          subnavAriaLabel="Speisekarten-Bereiche"
          subnavItems={MENU_MODULE_NAV}
        />
      ) : null}
      <AppMain>
        <Suspense fallback={null}>
          <MenuOverviewScreen active={active} />
        </Suspense>
      </AppMain>
    </>
  );
}
