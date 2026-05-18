"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarDays,
  LayoutDashboard,
  LogOut,
  Package,
  Settings,
  UtensilsCrossed,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { useRestaurantProfile } from "@/lib/contexts/restaurant-profile-context";
import { usePersonalProfileNames } from "@/lib/hooks/use-personal-profile-names";
import { formatOrderProtocolUserName } from "@/lib/types/purchase-order";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

function profileInitials(firstName: string, lastName: string): string {
  const fi = firstName.trim();
  const la = lastName.trim();
  const a = fi.slice(0, 1).toLocaleUpperCase("de-DE");
  const b = la.slice(0, 1).toLocaleUpperCase("de-DE");
  if (a && b) return a + b;
  if (a && fi.length >= 2) return a + fi.slice(1, 2).toLocaleUpperCase("de-DE");
  if (a) return `${a}?`;
  if (b && la.length >= 2)
    return (
      la.slice(0, 1).toLocaleUpperCase("de-DE") +
      la.slice(1, 2).toLocaleUpperCase("de-DE")
    );
  if (b) return `?${b}`;
  return "?";
}

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { profile } = useRestaurantProfile();
  const { firstName, lastName } = usePersonalProfileNames();

  const displayName =
    profile.name.trim() || "Restaurant";

  const userFullName =
    formatOrderProtocolUserName({ firstName, lastName }) || "Profil";
  const initials = profileInitials(firstName, lastName);
  const headerTooltip = `${userFullName} · ${displayName}`;

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader className="box-border flex h-[var(--app-chrome-header-h)] min-h-[var(--app-chrome-header-h)] shrink-0 justify-center gap-0 border-b border-border/50 p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="default"
              tooltip={headerTooltip}
              render={<Link href="/workspace/restaurants" prefetch />}
              className="min-h-0 !h-auto gap-2 overflow-hidden px-2.5 py-1 group-data-[collapsible=icon]:!size-8 group-data-[collapsible=icon]:!min-h-8 group-data-[collapsible=icon]:!p-0"
            >
              <div className="flex aspect-square size-7 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-[0.625rem] font-bold leading-none tracking-tight text-sidebar-primary-foreground group-data-[collapsible=icon]:size-full group-data-[collapsible=icon]:max-h-none group-data-[collapsible=icon]:rounded-full group-data-[collapsible=icon]:text-[0.5625rem]">
                {initials}
              </div>
              <div className="grid min-h-0 min-w-0 flex-1 content-center gap-0 text-left leading-none group-data-[collapsible=icon]:hidden">
                <span className="truncate font-semibold tracking-tight">
                  {userFullName}
                </span>
                <span className="truncate text-[10px] text-sidebar-foreground/70">
                  {displayName}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="gap-2">
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/65">
            Module
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1.5">
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={pathname === "/dashboard"}
                  tooltip="Dashboard"
                  render={<Link href="/dashboard" prefetch />}
                >
                  <LayoutDashboard />
                  <span>Dashboard</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={pathname.startsWith("/menu")}
                  tooltip="Speisekarte"
                  render={<Link href="/menu/uebersicht" prefetch />}
                >
                  <UtensilsCrossed />
                  <span>Speisekarte</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={pathname.startsWith("/inventory")}
                  tooltip="Bestand"
                  render={<Link href="/inventory" prefetch />}
                >
                  <Package />
                  <span>Bestand</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={pathname.startsWith("/reservierungen")}
                  tooltip="Reservierungen"
                  render={<Link href="/reservierungen/uebersicht" prefetch />}
                >
                  <CalendarDays />
                  <span>Reservierungen</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarSeparator />
      <SidebarFooter>
        <SidebarMenu className="gap-1.5">
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={pathname.startsWith("/settings")}
              tooltip="Einstellungen"
              render={<Link href="/settings" prefetch />}
            >
              <Settings />
              <span>Einstellungen</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              type="button"
              tooltip="Abmelden"
              className="text-sidebar-foreground/80"
              onClick={() => {
                void (async () => {
                  const sb = createSupabaseBrowserClient();
                  await sb.auth.signOut();
                  router.replace("/login");
                  router.refresh();
                })();
              }}
            >
              <LogOut />
              <span>Abmelden</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
