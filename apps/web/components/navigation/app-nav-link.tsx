"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";
import { useSoftNavCoordinator } from "@/components/providers/soft-nav-coordinator";
import {
  assignCrossAppWorkspaceZone,
  crossAppModuleNavigation,
} from "@/lib/navigation/app-zone-navigation";

function hrefToString(href: string | { pathname?: string; search?: string }): string {
  if (typeof href === "string") return href;
  const pathname = href.pathname ?? "/dashboard";
  const search = href.search ?? "";
  return `${pathname}${search}`;
}

/**
 * Interner App-Link: Soft-Nav in der App-Zone; nur Wechsel App ↔ Superadmin per Full-Load.
 * Modulwechsel: Coordinator serialisiert RSC-Flights (useTransition + Coalescing).
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
  const { scheduleCrossModuleNav } = useSoftNavCoordinator();
  const hrefStr = hrefToString(href);
  const crossModuleNav = crossAppModuleNavigation(pathname, hrefStr);
  const shouldPrefetch = prefetch ?? !crossModuleNav;

  return (
    <Link
      href={href}
      prefetch={shouldPrefetch}
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

        event.preventDefault();
        scheduleCrossModuleNav(hrefStr);
      }}
    >
      {children}
    </Link>
  );
}
