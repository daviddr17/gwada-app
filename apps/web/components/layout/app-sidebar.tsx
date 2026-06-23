"use client";

import { useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import { AppNavLink } from "@/components/navigation/app-nav-link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  Building2,
  Database,
  LayoutDashboard,
  LogOut,
  Plug,
  ScrollText,
  FileText,
  Settings,
  Settings2,
  Shield,
  Users,
  Workflow,
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
import {
  SIDEBAR_MODULE_BY_ID,
  type SidebarModuleId,
} from "@/lib/constants/sidebar-modules";
import { useSidebarModuleOrder } from "@/lib/contexts/sidebar-module-order-context";
import { formatSidebarMenuLabel } from "@/lib/navigation/format-sidebar-menu-label";
import { sidebarModuleNotificationCount } from "@/lib/navigation/sidebar-module-notification-counts";
import { useNotificationSummary } from "@/lib/hooks/use-notification-summary";
import { useRestaurantPermissions } from "@/lib/hooks/use-restaurant-permissions";
import { hasSidebarModuleAccess } from "@/lib/permissions/sidebar-module-permissions";
import { useSuperadminChangelogPendingCount } from "@/lib/hooks/use-superadmin-changelog-pending-count";

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
  const { order: sidebarModuleOrder } = useSidebarModuleOrder();
  const { has, loading: permissionsLoading } = useRestaurantPermissions();
  const inSuperadmin = pathname.startsWith("/superadmin");
  const { summary: notificationSummary } = useNotificationSummary();
  const { count: pendingChangelogCount } = useSuperadminChangelogPendingCount(
    isSuperadmin && inSuperadmin,
  );

  const orderedSidebarModules = useMemo(
    () =>
      sidebarModuleOrder
        .map((id: SidebarModuleId) => SIDEBAR_MODULE_BY_ID.get(id))
        .filter((mod): mod is NonNullable<typeof mod> => mod != null)
        .filter(
          (mod) =>
            permissionsLoading || hasSidebarModuleAccess(has, mod.id),
        ),
    [sidebarModuleOrder, has, permissionsLoading],
  );

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
                      isActive={pathname.startsWith(
                        "/superadmin/lade-strategie",
                      )}
                      tooltip="Lade- & Cache-Strategie"
                      render={
                        <Link href="/superadmin/lade-strategie" prefetch />
                      }
                    >
                      <Workflow />
                      <span>Lade-Strategie</span>
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
                      <span>
                        {formatSidebarMenuLabel(
                          "Changelog",
                          pendingChangelogCount,
                        )}
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={pathname.startsWith(
                        "/superadmin/vertragsvorlagen",
                      )}
                      tooltip="Vertragsvorlagen"
                      render={
                        <Link href="/superadmin/vertragsvorlagen" prefetch />
                      }
                    >
                      <FileText />
                      <span>Vertragsvorlagen</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={pathname.startsWith(
                        "/superadmin/benachrichtigungen",
                      )}
                      tooltip="Benachrichtigungen"
                      render={
                        <Link href="/superadmin/benachrichtigungen" prefetch />
                      }
                    >
                      <Bell />
                      <span>Benachrichtigungen</span>
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
                  {orderedSidebarModules.map((mod) => {
                    const Icon = mod.icon;
                    const badgeCount = sidebarModuleNotificationCount(
                      notificationSummary,
                      mod.id,
                    );
                    return (
                      <SidebarMenuItem key={mod.id}>
                        <SidebarMenuButton
                          isActive={pathname.startsWith(mod.pathPrefix)}
                          tooltip={mod.tooltip}
                          render={<AppNavLink href={mod.href} />}
                        >
                          <Icon />
                          <span>
                            {formatSidebarMenuLabel(mod.label, badgeCount)}
                          </span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
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
