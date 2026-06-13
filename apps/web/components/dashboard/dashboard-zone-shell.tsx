"use client";

import { useRef } from "react";
import { usePathname } from "next/navigation";
import { DashboardHomeScreen } from "@/components/dashboard/dashboard-home-screen";
import { isDashboardHomePath } from "@/lib/navigation/dashboard-home-path";
import { cn } from "@/lib/utils";

export { isDashboardHomePath } from "@/lib/navigation/dashboard-home-path";

/**
 * Dashboard-Home bleibt nach erstem Besuch warm gemountet (nur Sichtbarkeit) —
 * kein Widget-Remount bei Modul→Dashboard, `{children}` bleibt Router-Anker.
 */
export function DashboardZoneShell({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const isHome = isDashboardHomePath(pathname);
  const homeEverMountedRef = useRef(isHome);
  if (isHome) homeEverMountedRef.current = true;

  return (
    <>
      {homeEverMountedRef.current ? (
        <div className={cn(!isHome && "hidden")} aria-hidden={!isHome}>
          <DashboardHomeScreen active={isHome} />
        </div>
      ) : null}
      {isHome ? (
        <div className="hidden" aria-hidden>
          {children}
        </div>
      ) : (
        children
      )}
    </>
  );
}
