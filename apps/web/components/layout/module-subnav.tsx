"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useLayoutEffect, useRef } from "react";
import { AppNavLink } from "@/components/navigation/app-nav-link";
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { scheduleModuleSubnavRoutePrefetches } from "@/lib/hooks/module-subnav-route-prefetch";
import { warmModuleRouteIntent } from "@/lib/hooks/app-module-intent-prefetch";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { cn } from "@/lib/utils";

export type ModuleSubnavItem = {
  href: string;
  label: string;
  matchMode?: "exact" | "prefix";
  activeWhen?: readonly string[];
  disabled?: boolean;
};

function normalizePath(p: string): string {
  if (p.length > 1 && p.endsWith("/")) return p.slice(0, -1);
  return p;
}

function pathOnlyFromHref(href: string): string {
  const q = href.indexOf("?");
  const path = q === -1 ? href : href.slice(0, q);
  return normalizePath(path);
}

function searchParamsFromHref(href: string): URLSearchParams | null {
  const q = href.indexOf("?");
  if (q === -1) return null;
  return new URLSearchParams(href.slice(q + 1));
}

export function isActiveModuleSubnavItem(
  pathname: string,
  searchParams: URLSearchParams,
  item: ModuleSubnavItem,
): boolean {
  if (!isActiveModulePath(pathname, item)) return false;
  const expected = searchParamsFromHref(item.href);
  if (!expected || expected.size === 0) return true;
  for (const key of expected.keys()) {
    if (searchParams.get(key) !== expected.get(key)) return false;
  }
  return true;
}

export function isActiveModulePath(
  pathname: string,
  item: ModuleSubnavItem,
): boolean {
  if (item.disabled) return false;
  const path = normalizePath(pathname);
  const h = pathOnlyFromHref(item.href);
  for (const extra of item.activeWhen ?? []) {
    const e = normalizePath(extra);
    if (path === e) return true;
  }
  const mode = item.matchMode ?? "prefix";
  if (mode === "exact") {
    return path === h;
  }
  return path === h || path.startsWith(`${h}/`);
}

/**
 * Horizontale Untermenüpunkte wie in der linken Sidebar (SidebarMenuButton),
 * ohne eigenen Karten-Rahmen oder Hintergrund.
 */
export function ModuleChipNav({
  items,
  "aria-label": ariaLabel,
  className,
}: {
  items: readonly ModuleSubnavItem[];
  "aria-label": string;
  className?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { restaurantId } = useWorkspaceRestaurantUuid();
  const prefetchTimeoutsRef = useRef<number[]>([]);

  useLayoutEffect(() => {
    for (const timeoutId of prefetchTimeoutsRef.current) {
      window.clearTimeout(timeoutId);
    }
    prefetchTimeoutsRef.current = scheduleModuleSubnavRoutePrefetches(
      router,
      queryClient,
      restaurantId,
      items,
      pathname,
    );
    return () => {
      for (const timeoutId of prefetchTimeoutsRef.current) {
        window.clearTimeout(timeoutId);
      }
      prefetchTimeoutsRef.current = [];
    };
  }, [items, pathname, queryClient, restaurantId, router]);

  const warmOnIntent = useCallback(
    (href: string) => {
      warmModuleRouteIntent(router, queryClient, restaurantId, href);
    },
    [queryClient, restaurantId, router],
  );

  return (
    <nav
      aria-label={ariaLabel}
      className={cn(
        "min-w-0 flex-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      <SidebarGroup className="p-0">
        <SidebarMenu className="flex-row flex-nowrap gap-1.5">
          {items.map((item) => {
            const navHref = mergeSubnavHref(item.href, searchParams);
            const active = isActiveModuleSubnavItem(
              pathname,
              searchParams,
              item,
            );
            if (item.disabled) {
              return (
                <SidebarMenuItem
                  key={`${item.label}-${item.href}`}
                  className="w-auto shrink-0"
                >
                  <SidebarMenuButton
                    disabled
                    layout="text"
                    className="pointer-events-none opacity-50"
                  >
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            }
            return (
              <SidebarMenuItem key={item.href} className="w-auto shrink-0">
                <SidebarMenuButton
                  isActive={active}
                  layout="text"
                  onPointerEnter={() => warmOnIntent(navHref)}
                  onFocus={() => warmOnIntent(navHref)}
                  render={<AppNavLink href={navHref} />}
                >
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroup>
    </nav>
  );
}
