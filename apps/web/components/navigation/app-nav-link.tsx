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
import { useDashboardSpaNavigationOptional } from "@/lib/navigation/dashboard-spa-navigation-bridge";
import { isDashboardSpaHref } from "@/lib/navigation/dashboard-spa-path";
import { assignCrossAppWorkspaceZone } from "@/lib/navigation/app-zone-navigation";
import { crossAppModuleNavigation } from "@/lib/navigation/app-module-navigation";

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
 * Interner Modul-Link — Soft-Nav mit sofortigem Pending + router.push.
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
    const { restaurantId } = useWorkspaceRestaurantUuid();
    const { tryAcquireNavLock, scheduleSoftNavPush, pendingHref } =
      useSoftNavLock();
    const spaNav = useDashboardSpaNavigationOptional();
    const inDashboardSpa = spaNav != null;
    const hrefStr = hrefToString(href);
    const crossModuleNav = crossAppModuleNavigation(pathname, hrefStr);
    const spaDashboardHref = inDashboardSpa && isDashboardSpaHref(hrefStr);

    const warmOnIntent = useCallback(() => {
      if (!isDashboardSpaHref(hrefStr)) return;
      warmModuleRouteIntent(router, queryClient, restaurantId, hrefStr);
    }, [hrefStr, router, queryClient, restaurantId]);

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
          // Pending erst im click: pointerdown+Pending vor synthetischem click
          // kann auf iOS Keep-alive-Slots umbauen und den click killen.
        }}
        onClick={(event) => {
          onClick?.(event);
          if (event.defaultPrevented) return;
          if (assignCrossAppWorkspaceZone(pathname, hrefStr)) {
            event.preventDefault();
            return;
          }
          if (!spaDashboardHref && !crossModuleNav) {
            // Gleicher Modul-Stamm (Legacy Next): natives Link — außer Flight läuft.
            if (!pendingHref) return;
          }
          // Cmd/Ctrl-Klick etc. → natives Link-Verhalten (neuer Tab).
          if (
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey ||
            event.button !== 0
          ) {
            return;
          }
          // Sofort Pending (Titel/Cover), Push coalesced (letzter Klick gewinnt).
          // Flight hängt nicht am <a> im Mobile-Sheet (Close/Unmount killt sonst Nav).
          event.preventDefault();
          if (!tryAcquireNavLock(event, hrefStr)) return;
          scheduleSoftNavPush(hrefStr);
        }}
      >
        {children}
      </Link>
    );
  },
);

AppNavLink.displayName = "AppNavLink";
