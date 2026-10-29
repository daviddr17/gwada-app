"use client";

import { usePathname } from "next/navigation";
import { RegisterModuleSecondarySubnav } from "@/lib/contexts/app-module-chrome-context";
import { POS_SETTINGS_SECONDARY_NAV } from "@/components/pos/pos-settings-secondary-nav";
import { APP_ROUTES } from "@/lib/navigation/app-routes";

function isPosSettingsPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return (
    pathname === APP_ROUTES.pos.settings ||
    pathname.startsWith(`${APP_ROUTES.pos.settings}/`)
  );
}

/** Secondary chips under POS → Einstellungen (SPA; replaces pruned Next layout). */
export function PosSettingsSubnav() {
  const pathname = usePathname();
  if (!isPosSettingsPath(pathname)) return null;
  return (
    <RegisterModuleSecondarySubnav
      ariaLabel="POS-Einstellungen"
      items={POS_SETTINGS_SECONDARY_NAV}
    />
  );
}
