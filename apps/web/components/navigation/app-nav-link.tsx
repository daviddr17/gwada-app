"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";
import { assignCrossAppWorkspaceZone } from "@/lib/navigation/app-zone-navigation";

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
  prefetch = true,
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
  const hrefStr = hrefToString(href);

  return (
    <Link
      href={href}
      prefetch={prefetch}
      className={className}
      aria-label={ariaLabel}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        if (assignCrossAppWorkspaceZone(pathname, hrefStr)) {
          event.preventDefault();
        }
      }}
    >
      {children}
    </Link>
  );
}
