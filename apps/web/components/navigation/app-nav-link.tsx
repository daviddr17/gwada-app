"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";
import { isDashboardHomePath } from "@/lib/navigation/dashboard-home-path";
import { navigateDashboardHome } from "@/lib/navigation/navigate-dashboard-home";
import {
  assignCrossAppWorkspaceZone,
  crossAppModuleNavigation,
} from "@/lib/navigation/app-zone-navigation";
import {
  beginSoftNavFlight,
  isSoftNavFlightActive,
} from "@/lib/navigation/soft-nav-flight-guard";
import { enqueueAppSoftNav } from "@/lib/navigation/soft-nav-queue";

function hrefToString(href: string | { pathname?: string; search?: string }): string {
  if (typeof href === "string") return href;
  const pathname = href.pathname ?? "/dashboard";
  const search = href.search ?? "";
  return `${pathname}${search}`;
}

/**
 * Interner App-Link: Soft-Nav in der App-Zone; nur Wechsel App ↔ Superadmin per Full-Load.
 * Modul→Dashboard: serialisiert, Cookies bereinigen, dann router.replace.
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
          if (isSoftNavFlightActive()) return;
          enqueueAppSoftNav(async () => {
            if (!beginSoftNavFlight(hrefStr)) return;
            await navigateDashboardHome(router, hrefStr);
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
