"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";
import { useSoftNavGuard } from "@/components/providers/soft-nav-guard-provider";
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
 * Interner App-Link: Soft-Nav über nativen Next-Link (kein router.push-Intercept).
 * Parallele Modul-Klicks werden blockiert; RSC-Flight bleibt im Router.
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
  const { onCrossModuleClick } = useSoftNavGuard();
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
        if (crossModuleNav) {
          onCrossModuleClick(event);
        }
      }}
    >
      {children}
    </Link>
  );
}
