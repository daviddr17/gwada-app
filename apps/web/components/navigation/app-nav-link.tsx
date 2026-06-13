"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";
import { useSoftNavLock } from "@/components/providers/soft-nav-lock-provider";
import { assignCrossAppWorkspaceZone } from "@/lib/navigation/app-zone-navigation";
import { crossAppModuleNavigation } from "@/lib/navigation/app-module-navigation";

function hrefToString(href: string | { pathname?: string; search?: string }): string {
  if (typeof href === "string") return href;
  const pathname = href.pathname ?? "/dashboard";
  const search = href.search ?? "";
  return `${pathname}${search}`;
}

/**
 * Interner Link — nativer Next-Link; parallele Modul-Klicks blockieren bis Route steht.
 */
export function AppNavLink({
  href,
  children,
  className,
  onClick,
  prefetch = false,
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
  const { tryAcquireNavLock } = useSoftNavLock();
  const hrefStr = hrefToString(href);
  const crossModuleNav = crossAppModuleNavigation(pathname, hrefStr);

  return (
    <Link
      href={href}
      prefetch={prefetch}
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
        if (crossModuleNav && !tryAcquireNavLock(event)) {
          return;
        }
      }}
    >
      {children}
    </Link>
  );
}
