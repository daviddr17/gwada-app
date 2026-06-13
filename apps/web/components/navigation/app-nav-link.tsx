"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";
import { isDashboardHomePath } from "@/lib/navigation/dashboard-home-path";
import {
  assignCrossAppWorkspaceZone,
  crossAppModuleNavigation,
} from "@/lib/navigation/app-zone-navigation";
import {
  beginSoftNavFlight,
  isSoftNavFlightActive,
} from "@/lib/navigation/soft-nav-flight-guard";

function hrefToString(href: string | { pathname?: string; search?: string }): string {
  if (typeof href === "string") return href;
  const pathname = href.pathname ?? "/dashboard";
  const search = href.search ?? "";
  return `${pathname}${search}`;
}

async function cleanupAuthCookiesBeforeNav(): Promise<void> {
  try {
    await fetch("/api/auth/cleanup-cookies", { credentials: "include" });
  } catch {
    // Proxy strippt gwada_* trotzdem serverseitig — Nav nicht blockieren.
  }
}

/**
 * Interner App-Link: Soft-Nav in der App-Zone; nur Wechsel App ↔ Superadmin per Full-Load.
 * Zurück zum Dashboard: Cookies bereinigen, dann router.replace (stabiler RSC-Flight auf Live).
 */
export function AppNavLink({
  href,
  children,
  className,
  onClick,
  prefetch,
  "aria-label": ariaLabel,
}: {
  href: string | { pathname?: string; search?: string };
  children?: ReactNode;
  className?: string;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
  prefetch?: boolean;
  "aria-label"?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const hrefStr = hrefToString(href);
  const crossModuleNav = crossAppModuleNavigation(pathname, hrefStr);
  const returningToDashboard =
    crossModuleNav &&
    isDashboardHomePath(hrefStr) &&
    !isDashboardHomePath(pathname);
  const shouldPrefetch =
    prefetch ??
    !(isDashboardHomePath(hrefStr) && crossModuleNav && !isDashboardHomePath(pathname));

  return (
    <Link
      href={href}
      prefetch={shouldPrefetch}
      replace={returningToDashboard}
      scroll={false}
      className={className}
      aria-label={ariaLabel}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        if (assignCrossAppWorkspaceZone(pathname, hrefStr)) {
          event.preventDefault();
          return;
        }
        if (!crossModuleNav) return;

        if (returningToDashboard) {
          event.preventDefault();
          if (isSoftNavFlightActive() || !beginSoftNavFlight(hrefStr)) return;
          void cleanupAuthCookiesBeforeNav().then(() => {
            router.replace(hrefStr);
          });
          return;
        }

        if (isSoftNavFlightActive() || !beginSoftNavFlight(hrefStr)) {
          event.preventDefault();
        }
      }}
    >
      {children}
    </Link>
  );
}
