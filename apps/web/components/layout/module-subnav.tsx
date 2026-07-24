"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useLayoutEffect, useRef } from "react";
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { scheduleModuleSubnavRoutePrefetches } from "@/lib/hooks/module-subnav-route-prefetch";
import { warmModuleRouteIntent } from "@/lib/hooks/app-module-intent-prefetch";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { prefetchAppModuleHref } from "@/lib/navigation/prefetch-app-module-href";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
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

export function isActiveModulePath(
  pathname: string,
  item: ModuleSubnavItem,
): boolean {
  if (item.disabled) return false;
  const path = normalizePath(pathname);
  const h = normalizePath(item.href);
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
  const router = useRouter();
  const queryClient = useQueryClient();
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const prefetchTimeoutsRef = useRef<number[]>([]);

  useLayoutEffect(() => {
    for (const timeoutId of prefetchTimeoutsRef.current) {
      window.clearTimeout(timeoutId);
    }
    prefetchTimeoutsRef.current = scheduleModuleSubnavRoutePrefetches(
      router,
      queryClient,
      workspaceReady && restaurantId && isUuidRestaurantId(restaurantId)
        ? restaurantId
        : null,
      items,
      pathname,
    );
    return () => {
      for (const timeoutId of prefetchTimeoutsRef.current) {
        window.clearTimeout(timeoutId);
      }
      prefetchTimeoutsRef.current = [];
    };
  }, [items, pathname, queryClient, restaurantId, router, workspaceReady]);

  const warmOnIntent = useCallback(
    (href: string) => {
      if (
        !workspaceReady ||
        !restaurantId ||
        !isUuidRestaurantId(restaurantId)
      ) {
        prefetchAppModuleHref(router, href);
        return;
      }
      warmModuleRouteIntent(router, queryClient, restaurantId, href);
    },
    [queryClient, restaurantId, router, workspaceReady],
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
            const active = isActiveModulePath(pathname, item);
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
                  onPointerEnter={() => warmOnIntent(item.href)}
                  onFocus={() => warmOnIntent(item.href)}
                  render={<Link href={item.href} prefetch scroll={false} />}
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
