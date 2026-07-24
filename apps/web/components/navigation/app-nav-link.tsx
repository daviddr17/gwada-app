"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  forwardRef,
  useCallback,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { useSoftNavLock } from "@/components/providers/soft-nav-lock-provider";
import { warmModuleRouteIntent } from "@/lib/hooks/app-module-intent-prefetch";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { assignCrossAppWorkspaceZone } from "@/lib/navigation/app-zone-navigation";
import { crossAppModuleNavigation } from "@/lib/navigation/app-module-navigation";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

function hrefToString(href: string | { pathname?: string; search?: string }): string {
  if (typeof href === "string") return href;
  const pathname = href.pathname ?? "/dashboard";
  const search = href.search ?? "";
  return `${pathname}${search}`;
}

/**
 * Interner Link — nativer Next-Link; parallele Modul-Klicks blockieren bis Route steht.
 */
export const AppNavLink = forwardRef<
  HTMLAnchorElement,
  {
    href: string | { pathname?: string; search?: string };
    children?: ReactNode;
    className?: string;
    onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
    prefetch?: boolean;
    "aria-label"?: string;
  }
>(function AppNavLink(
  {
    href,
    children,
    className,
    onClick,
    prefetch = true,
    "aria-label": ariaLabel,
  },
  ref,
) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const { tryAcquireNavLock } = useSoftNavLock();
  const hrefStr = hrefToString(href);
  const crossModuleNav = crossAppModuleNavigation(pathname, hrefStr);

  const warmOnIntent = useCallback(() => {
    if (
      !crossModuleNav ||
      !workspaceReady ||
      !restaurantId ||
      !isUuidRestaurantId(restaurantId)
    ) {
      return;
    }
    warmModuleRouteIntent(router, queryClient, restaurantId, hrefStr);
  }, [
    crossModuleNav,
    workspaceReady,
    restaurantId,
    router,
    queryClient,
    hrefStr,
  ]);

  return (
    <Link
      ref={ref}
      href={href}
      prefetch={prefetch}
      scroll={false}
      className={className}
      aria-label={ariaLabel}
      onPointerEnter={warmOnIntent}
      onFocus={warmOnIntent}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        if (assignCrossAppWorkspaceZone(pathname, hrefStr)) {
          event.preventDefault();
          return;
        }
        // Pending-Highlight ohne Lock/preventDefault (Locks haben Flights gekillt).
        if (crossModuleNav) {
          tryAcquireNavLock(event, hrefStr);
        }
      }}
    >
      {children}
    </Link>
  );
});

AppNavLink.displayName = "AppNavLink";
