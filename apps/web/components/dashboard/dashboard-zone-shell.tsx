"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { endSoftNavFlight } from "@/lib/navigation/soft-nav-flight-guard";

export { isDashboardHomePath } from "@/lib/navigation/dashboard-home-path";

/** Zone-Layout: Flight-Lock freigeben; Page-Inhalt kommt aus `{children}`. */
export function DashboardZoneShell({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();

  useEffect(() => {
    endSoftNavFlight(pathname);
  }, [pathname]);

  return children;
}
