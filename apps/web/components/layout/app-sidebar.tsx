"use client";

import { useCallback, useEffect } from "react";
import Link from "next/link";
import { AppNavLink } from "@/components/navigation/app-nav-link";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2,
  CalendarDays,
  Database,
  FileText,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Newspaper,
  Package,
  Plug,
  ScrollText,
  Star,
  Receipt,
  Settings,
  Settings2,
  Shield,
  Users,
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
  useSidebar,
} from "@/components/ui/sidebar";
import { useRestaurantProfile } from "@/lib/contexts/restaurant-profile-context";
import { usePersonalProfileNames } from "@/lib/hooks/use-personal-profile-names";
import { formatOrderProtocolUserName } from "@/lib/types/purchase-order";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { AppSidebarBrandLogo } from "@/components/layout/app-sidebar-brand-logo";
import { useIsSuperadmin } from "@/lib/hooks/use-is-superadmin";
import { assignCrossAppWorkspaceZone } from "@/lib/navigation/app-zone-navigation";

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
  const { isMobile, setOpenMobile } = useSidebar();
  const { profile } = useRestaurantProfile();
  const { firstName, lastName } = usePersonalProfileNames();
  const { isSuperadmin } = useIsSuperadmin();
  const inSuperadmin = pathname.startsWith("/superadmin");

  const displayName =
    profile.name.trim() || "Restaurant";

  const userFullName =
    formatOrderProtocolUserName({ firstName, lastName }) || "Profil";
  const initials = profileInitials(firstName, lastName);
  const headerTooltip = `${userFullName} · ${displayName}`;

  useEffect(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
  }, [pathname, isMobile, setOpenMobile]);

  const closeMobileSidebarOnNav = useCallback(
    (event: React.MouseEvent) => {
      if (!isMobile) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest("a[href], button")) {
        setOpenMobile(false);
      }
    },
    [isMobile, setOpenMobile],
  );

  return (
    <Sidebar collapsible="icon" variant="inset">
      <div
        className="flex h-full w-full flex-col"
        onClickCapture={closeMobileSidebarOnNav}
      >
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
      <SidebarContent className="flex min-h-0 flex-1 flex-col gap-2">
        <SidebarGroup className="min-h-0 flex-1">
          <SidebarGroupLabel className="text-sidebar-foreground/65">
            {inSuperadmin ? "Superadmin" : "Module"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1.5">
              {inSuperadmin ? (
                <>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={pathname.startsWith("/superadmin/allgemein")}
                      tooltip="Allgemein"
                      render={
                        <Link href="/superadmin/allgemein" prefetch />
                      }
                    >
                      <Settings2 />
                      <span>Allgemein</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={pathname.startsWith("/superadmin/users")}
                      tooltip="User"
                      render={<Link href="/superadmin/users" prefetch />}
                    >
                      <Users />
                      <span>User</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={pathname.startsWith(
                        "/superadmin/restaurants",
                      )}
                      tooltip="Restaurants"
                      render={
                        <Link href="/superadmin/restaurants" prefetch />
                      }
                    >
                      <Building2 />
                      <span>Restaurants</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={pathname.startsWith("/superadmin/integrationen")}
                      tooltip="Integrationen"
                      render={
                        <Link href="/superadmin/integrationen" prefetch />
                      }
                    >
                      <Plug />
                      <span>Integrationen</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={pathname.startsWith("/superadmin/datenbank")}
                      tooltip="Datenbank"
                      render={<Link href="/superadmin/datenbank" prefetch />}
                    >
                      <Database />
                      <span>Datenbank</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={pathname.startsWith("/superadmin/changelog")}
                      tooltip="Changelog"
                      render={
                        <Link href="/superadmin/changelog" prefetch />
                      }
                    >
                      <ScrollText />
                      <span>Changelog</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </>
              ) : (
                <>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={pathname === "/dashboard"}
                      tooltip="Dashboard"
                      render={<AppNavLink href="/dashboard" />}
                    >
                      <LayoutDashboard />
                      <span>Dashboard</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={pathname.startsWith("/dashboard/menu")}
                      tooltip="Speisekarte"
                      render={<AppNavLink href="/dashboard/menu/uebersicht" />}
                    >
                      <UtensilsCrossed />
                      <span>Speisekarte</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={pathname.startsWith("/dashboard/inventory")}
                      tooltip="Bestand"
                      render={<AppNavLink href="/dashboard/inventory/uebersicht" />}
                    >
                      <Package />
                      <span>Bestand</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={pathname.startsWith("/dashboard/reservierungen")}
                      tooltip="Reservierungen"
                      render={
                        <AppNavLink href="/dashboard/reservierungen/uebersicht" />
                      }
                    >
                      <CalendarDays />
                      <span>Reservierungen</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={pathname.startsWith("/dashboard/kontakte")}
                      tooltip="Nachrichten"
                      render={
                        <AppNavLink href="/dashboard/kontakte/nachrichten?platform=all" />
                      }
                    >
                      <MessageCircle />
                      <span>Nachrichten</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={pathname.startsWith("/dashboard/news")}
                      tooltip="News"
                      render={<AppNavLink href="/dashboard/news/uebersicht" />}
                    >
                      <Newspaper />
                      <span>News</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={pathname.startsWith("/dashboard/bewertungen")}
                      tooltip="Bewertungen"
                      render={<AppNavLink href="/dashboard/bewertungen/uebersicht" />}
                    >
                      <Star />
                      <span>Bewertungen</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={pathname.startsWith("/dashboard/buchfuehrung")}
                      tooltip="Buchführung"
                      render={
                        <AppNavLink href="/dashboard/buchfuehrung/rechnungen" />
                      }
                    >
                      <Receipt />
                      <span>Buchführung</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={pathname.startsWith("/dashboard/dokumente")}
                      tooltip="Dokumente"
                      render={<AppNavLink href="/dashboard/dokumente/uebersicht" />}
                    >
                      <FileText />
                      <span>Dokumente</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={pathname.startsWith("/dashboard/mitarbeiter")}
                      tooltip="Mitarbeiter"
                      render={
                        <AppNavLink href="/dashboard/mitarbeiter/uebersicht" />
                      }
                    >
                      <Users />
                      <span>Mitarbeiter</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <AppSidebarBrandLogo />
      </SidebarContent>
      <SidebarSeparator />
      <SidebarFooter>
        <SidebarMenu className="gap-1.5">
          {isSuperadmin && !inSuperadmin ? (
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathname.startsWith("/superadmin")}
                tooltip="Superadmin"
                render={
                  <Link
                    href="/superadmin/allgemein"
                    prefetch={false}
                    onClick={(e) => {
                      if (
                        assignCrossAppWorkspaceZone(
                          pathname,
                          "/superadmin/allgemein",
                        )
                      ) {
                        e.preventDefault();
                      }
                    }}
                  />
                }
              >
                <Shield />
                <span>Superadmin</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ) : null}
          {inSuperadmin ? (
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathname === "/dashboard"}
                tooltip="Dashboard"
                render={
                  <Link
                    href="/dashboard"
                    prefetch={false}
                    onClick={(e) => {
                      if (assignCrossAppWorkspaceZone(pathname, "/dashboard")) {
                        e.preventDefault();
                      }
                    }}
                  />
                }
              >
                <LayoutDashboard />
                <span>Dashboard</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ) : null}
          {!inSuperadmin ? (
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathname.startsWith("/settings")}
                tooltip="Einstellungen"
                render={<AppNavLink href="/settings" />}
              >
                <Settings />
                <span>Einstellungen</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ) : null}
          {!inSuperadmin ? (
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathname.startsWith("/changelog")}
                tooltip="Changelog"
                render={<AppNavLink href="/changelog" />}
              >
                <ScrollText />
                <span>Changelog</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ) : null}
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
      </div>
    </Sidebar>
  );
}
