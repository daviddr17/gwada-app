"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
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
                  render={<Link href={item.href} prefetch={false} scroll={false} />}
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
