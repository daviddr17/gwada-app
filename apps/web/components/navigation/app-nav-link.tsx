"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  forwardRef,
  useCallback,
  type ComponentPropsWithoutRef,
  type FocusEvent,
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

type AppNavLinkProps = {
  href: string | { pathname?: string; search?: string };
  children?: ReactNode;
  className?: string;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
  onPointerDown?: (event: PointerEvent<HTMLAnchorElement>) => void;
  onPointerEnter?: (event: PointerEvent<HTMLAnchorElement>) => void;
  onFocus?: (event: FocusEvent<HTMLAnchorElement>) => void;
  prefetch?: boolean;
  "aria-label"?: string;
} & Omit<
  ComponentPropsWithoutRef<typeof Link>,
  | "href"
  | "prefetch"
  | "onClick"
  | "onPointerDown"
  | "onPointerEnter"
  | "onFocus"
  | "className"
  | "children"
  | "aria-label"
>;

/**
 * Interner Link — nativer Next-Link; parallele Modul-Klicks blockieren bis Route steht.
 * Rest-Props durchreichen (Base-UI `Button render={<AppNavLink … />}`).
 */
export const AppNavLink = forwardRef<HTMLAnchorElement, AppNavLinkProps>(
  function AppNavLink(
    {
      href,
      children,
      className,
      onClick,
      onPointerDown,
      onPointerEnter,
      onFocus,
      /** Default false: Next AUTO stoppt an loading.tsx — FULL über warmOnIntent. */
      prefetch = false,
      "aria-label": ariaLabel,
      ...rest
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
        {...rest}
        onPointerEnter={(event) => {
          onPointerEnter?.(event);
          warmOnIntent();
        }}
        onFocus={(event) => {
          onFocus?.(event);
          warmOnIntent();
        }}
        onPointerDown={(event) => {
          onPointerDown?.(event);
          // Touch/schneller Klick: FULL + Daten vor dem Flight (Hover fehlt oft).
          warmOnIntent();
          // Pending nur anstoßen (deferred im Provider) — nicht synchron setzen,
          // sonst re-rendert das Overlay im selben Tick und bricht den Flight ab.
          if (event.button !== 0 || !crossModuleNav) return;
          tryAcquireNavLock(event, hrefStr);
        }}
        onClick={(event) => {
          onClick?.(event);
          if (event.defaultPrevented) return;
          if (assignCrossAppWorkspaceZone(pathname, hrefStr)) {
            event.preventDefault();
            return;
          }
          // Pending ohne preventDefault — harte Locks haben Flights gekillt.
          if (crossModuleNav) {
            tryAcquireNavLock(event, hrefStr);
          }
        }}
      >
        {children}
      </Link>
    );
  },
);

AppNavLink.displayName = "AppNavLink";
