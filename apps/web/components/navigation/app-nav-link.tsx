"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";
import { isDashboardHomePath } from "@/components/dashboard/dashboard-zone-shell";
import {
  assignCrossAppWorkspaceZone,
  crossAppModuleNavigation,
  navigateAppPath,
} from "@/lib/navigation/app-zone-navigation";
import { isSoftNavFlightActive } from "@/lib/navigation/soft-nav-flight-guard";

function hrefToString(href: string | { pathname?: string; search?: string }): string {
  if (typeof href === "string") return href;
  const pathname = href.pathname ?? "/dashboard";
  const search = href.search ?? "";
  return `${pathname}${search}`;
}

/**
 * Interner App-Link: Soft-Nav in der App-Zone; nur Wechsel App ↔ Superadmin per Full-Load.
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
  const shouldPrefetch =
    prefetch ??
    !(isDashboardHomePath(hrefStr) && crossModuleNav && !isDashboardHomePath(pathname));

  return (
    <Link
      href={href}
      prefetch={shouldPrefetch}
      className={className}
      aria-label={ariaLabel}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        if (assignCrossAppWorkspaceZone(pathname, hrefStr)) {
          event.preventDefault();
          return;
        }
        if (crossModuleNav) {
          event.preventDefault();
          if (isSoftNavFlightActive()) return;
          navigateAppPath(router, pathname, hrefStr);
        }
      }}
    >
      {children}
    </Link>
  );
}
