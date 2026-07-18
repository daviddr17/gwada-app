"use client";

import { useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import { AppNavLink } from "@/components/navigation/app-nav-link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthLogoutTransition } from "@/components/auth/auth-logout-transition-provider";
import {
  normalizeNavHref,
  useSoftNavLock,
} from "@/components/providers/soft-nav-lock-provider";
import {
  Bell,
  Building2,
  Hourglass,
  LayoutDashboard,
  LogOut,
  Mail,
  Palette,
  Plug,
  RefreshCw,
  ScrollText,
  FileText,
  Files,
  Server,
  Settings,
  Settings2,
  Shield,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarSeparator,
  SIDEBAR_LABEL_MOTION,
  SIDEBAR_COMPACT_BUTTON,
  useSidebar,
} from "@/components/ui/sidebar";
import { useRestaurantProfile } from "@/lib/contexts/restaurant-profile-context";
import { usePersonalProfileNames } from "@/lib/hooks/use-personal-profile-names";
import { formatOrderProtocolUserName } from "@/lib/types/purchase-order";
import { useIsSuperadmin } from "@/lib/hooks/use-is-superadmin";
import { assignCrossAppWorkspaceZone } from "@/lib/navigation/app-zone-navigation";
import { APP_ROUTES } from "@/lib/navigation/app-routes";
import { SUPERADMIN_VORLAGEN_ROUTES } from "@/lib/navigation/superadmin-vorlagen-routes";
import {
  SUPERADMIN_SYSTEM_ROUTES,
  isSuperadminSystemPath,
} from "@/lib/navigation/superadmin-system-routes";
import {
  SIDEBAR_MODULE_BY_ID,
  type SidebarModuleId,
} from "@/lib/constants/sidebar-modules";
import { useSidebarModuleOrder } from "@/lib/contexts/sidebar-module-order-context";
import { APP_MODULE_PRIORITY_ROUTES } from "@/lib/navigation/app-module-priority-routes";
import { formatSidebarMenuLabel } from "@/lib/navigation/format-sidebar-menu-label";
import {
  sidebarChangelogUnreadCount,
  sidebarModuleNotificationCount,
} from "@/lib/navigation/sidebar-module-notification-counts";
import { useNotificationSummary } from "@/lib/hooks/use-notification-summary";
import { useRestaurantPermissions } from "@/lib/hooks/use-restaurant-permissions";
import { hasSidebarModuleAccess } from "@/lib/permissions/sidebar-module-permissions";
import { useSuperadminChangelogPendingCount } from "@/lib/hooks/use-superadmin-changelog-pending-count";
import { appChromeFixedZoneBgClassName } from "@/lib/ui/app-chrome-fixed-zone";
import {
  appMobileSidebarFooterMenuButtonClassName,
  appMobileSidebarFooterMenuClassName,
  appMobileSidebarGroupClassName,
  appMobileSidebarHeaderButtonClassName,
  appMobileSidebarModuleGroupContentClassName,
} from "@/lib/ui/app-mobile-sidebar-menu";
import { cn } from "@/lib/utils";

function profileInitials(firstName: string, lastName: string): string {
  const fi = firstName.trim();
  const la = lastName.trim();
  const a = fi.slice(0, 1).toLocaleUpperCase("de-DE");
  const b = la.slice(0, 1).toLocaleUpperCase("de-DE");
  if (a && b) return a + b;
  if (a && fi.length >= 2) return a + fi.slice(1, 2).toLocaleUpperCase("de-DE");
  if (a) return a;
  if (b && la.length >= 2)
    return (
      la.slice(0, 1).toLocaleUpperCase("de-DE") +
      la.slice(1, 2).toLocaleUpperCase("de-DE")
    );
  if (b) return b;
  return "";
}

function restaurantInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (
      words[0].slice(0, 1).toLocaleUpperCase("de-DE") +
      words[1].slice(0, 1).toLocaleUpperCase("de-DE")
    );
  }
  const word = words[0] ?? "";
  if (word.length >= 2) {
    return word.slice(0, 2).toLocaleUpperCase("de-DE");
  }
  return word.slice(0, 1).toLocaleUpperCase("de-DE");
}

const SIDEBAR_MODULE_SKELETON_COUNT = 10;

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { pendingHref } = useSoftNavLock();
  const { logout, isLoggingOut } = useAuthLogoutTransition();
  const { isMobile, setOpenMobile } = useSidebar();
  const { profile, isReady: profileReady } = useRestaurantProfile();
  const { firstName, lastName, isHydrated: profileNamesHydrated } =
    usePersonalProfileNames();
  const { isSuperadmin } = useIsSuperadmin();
  const { order: sidebarModuleOrder } = useSidebarModuleOrder();
  const {
    has,
    permissions,
    loading: permissionsLoading,
    error: permissionsError,
    reload: reloadPermissions,
  } = useRestaurantPermissions();
  const permissionsPending = permissionsLoading && permissions.size === 0;
  const inSuperadmin = pathname.startsWith("/superadmin");
  const { summary: notificationSummary } = useNotificationSummary();
  const { count: pendingChangelogCount } = useSuperadminChangelogPendingCount(
    isSuperadmin && inSuperadmin,
  );
  const changelogUnreadCount = sidebarChangelogUnreadCount(notificationSummary);

  const orderedSidebarModules = useMemo(
    () =>
      sidebarModuleOrder
        .map((id: SidebarModuleId) => SIDEBAR_MODULE_BY_ID.get(id))
        .filter((mod): mod is NonNullable<typeof mod> => mod != null)
        .filter((mod) => hasSidebarModuleAccess(has, mod.id)),
    [sidebarModuleOrder, has],
  );

  const displayName = profile.name.trim() || (profileReady ? "Restaurant" : "");
  const userFullName = formatOrderProtocolUserName({ firstName, lastName });
  const headerUserLabel =
    userFullName || (profileNamesHydrated ? "Profil" : "");
  const headerInitials =
    userFullName.length > 0
      ? profileInitials(firstName, lastName)
      : restaurantInitials(displayName) || "R";
  const headerTooltip = userFullName
    ? `${userFullName} · ${displayName || "Restaurant"}`
    : displayName || "Restaurant";

  useEffect(() => {
    for (const href of APP_MODULE_PRIORITY_ROUTES) {
      router.prefetch(href);
    }
  }, [router]);

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

  const mobileFooterMenuClassName = isMobile
    ? appMobileSidebarFooterMenuClassName
    : "gap-1.5";
  const mobileFooterButtonClassName = isMobile
    ? appMobileSidebarFooterMenuButtonClassName
    : undefined;

  return (
    <Sidebar collapsible="icon" variant="inset">
      <div
        className="flex h-full w-full flex-col"
        onClickCapture={closeMobileSidebarOnNav}
      >
      <SidebarHeader className={cn("box-border flex h-[var(--app-chrome-header-h)] min-h-[var(--app-chrome-header-h)] shrink-0 justify-center gap-0 border-b border-border/50 p-2", appChromeFixedZoneBgClassName)}>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="default"
              tooltip={headerTooltip}
              render={<Link href="/workspace/restaurants" prefetch />}
              className={cn(
                isMobile && appMobileSidebarHeaderButtonClassName,
                "!p-0 [--sidebar-menu-icon-col:2rem] grid-cols-[2rem_minmax(0,1fr)] group-data-[sidebar-labels-collapsed]/sidebar-wrapper:grid-cols-[2rem_0fr] ms-[5px]",
                SIDEBAR_COMPACT_BUTTON,
              )}
            >
              <div
                className={cn(
                  "col-start-1 row-start-1 flex size-8 shrink-0 items-center justify-center place-self-center rounded-lg bg-sidebar-primary text-[0.625rem] font-bold leading-none tracking-tight text-sidebar-primary-foreground group-data-[sidebar-icon-compact]/sidebar-wrapper:rounded-full",
                )}
              >
                {headerInitials}
              </div>
              <div
                className={cn(
                  "col-start-2 row-start-1 grid min-h-0 min-w-0 flex-1 content-center gap-0 overflow-hidden text-left leading-none group-data-[sidebar-labels-collapsed]/sidebar-wrapper:hidden",
                  SIDEBAR_LABEL_MOTION,
                )}
              >
                {headerUserLabel ? (
                  <span className="truncate font-semibold tracking-tight">
                    {headerUserLabel}
                  </span>
                ) : (
                  <span
                    className="block h-3.5 w-24 max-w-full rounded-md bg-sidebar-accent/50 skeleton-shimmer"
                    aria-hidden
                  />
                )}
                {displayName ? (
                  <span className="truncate text-[10px] text-sidebar-foreground/70">
                    {displayName}
                  </span>
                ) : profileReady ? null : (
                  <span
                    className="mt-0.5 block h-2.5 w-28 max-w-full rounded-md bg-sidebar-accent/40 skeleton-shimmer"
                    aria-hidden
                  />
                )}
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="flex min-h-0 flex-1 flex-col gap-2">
        <SidebarGroup className={cn("pb-1.5", isMobile && appMobileSidebarGroupClassName)}>
          <SidebarGroupContent
            className={isMobile ? appMobileSidebarModuleGroupContentClassName : undefined}
          >
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
                      isActive={pathname.startsWith("/superadmin/warteliste")}
                      tooltip="Warteliste"
                      render={<Link href="/superadmin/warteliste" prefetch />}
                    >
                      <Hourglass />
                      <span>Warteliste</span>
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
                      isActive={isSuperadminSystemPath(pathname)}
                      tooltip="System"
                      render={
                        <Link href={SUPERADMIN_SYSTEM_ROUTES.datenbank} prefetch />
                      }
                    >
                      <Server />
                      <span>System</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={pathname.startsWith(SUPERADMIN_VORLAGEN_ROUTES.root)}
                      tooltip="Vorlagen"
                      render={
                        <Link href={SUPERADMIN_VORLAGEN_ROUTES.vertragsvorlagen} prefetch />
                      }
                    >
                      <Files />
                      <span>Vorlagen</span>
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
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={pathname.startsWith("/superadmin/newsletter")}
                      tooltip="Newsletter"
                      render={
                        <Link href="/superadmin/newsletter" prefetch />
                      }
                    >
                      <Mail />
                      <span>Newsletter</span>
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
                      isActive={pathname.startsWith("/superadmin/design")}
                      tooltip="Design"
                      render={<Link href="/superadmin/design" prefetch />}
                    >
                      <Palette />
                      <span>Design</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </>
              ) : (
                <>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={
                        pathname === "/dashboard" ||
                        pendingHref === "/dashboard"
                      }
                      tooltip="Dashboard"
                      render={<AppNavLink href="/dashboard" />}
                    >
                      <LayoutDashboard />
                      <span>Dashboard</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  {permissionsPending ? (
                    Array.from({ length: SIDEBAR_MODULE_SKELETON_COUNT }, (_, i) => (
                      <SidebarMenuItem key={`perm-skeleton-${i}`}>
                        <SidebarMenuSkeleton showIcon />
                      </SidebarMenuItem>
                    ))
                  ) : permissionsError && orderedSidebarModules.length === 0 ? (
                    <SidebarMenuItem>
                      <div className="px-2 py-1">
                        <p className="mb-2 text-xs text-sidebar-foreground/70">
                          Module konnten nicht geladen werden.
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 w-full justify-center gap-1.5 text-xs"
                          onClick={() => void reloadPermissions()}
                        >
                          <RefreshCw className="size-3.5" aria-hidden />
                          Erneut versuchen
                        </Button>
                      </div>
                    </SidebarMenuItem>
                  ) : (
                    orderedSidebarModules.map((mod) => {
                      const Icon = mod.icon;
                      const notificationCount = sidebarModuleNotificationCount(
                        notificationSummary,
                        mod.id,
                      );
                      const modulePending =
                        pendingHref != null &&
                        normalizeNavHref(mod.href) === pendingHref;
                      return (
                        <SidebarMenuItem key={mod.id}>
                          <SidebarMenuButton
                            isActive={
                              pathname.startsWith(mod.pathPrefix) || modulePending
                            }
                            tooltip={mod.tooltip}
                            render={<AppNavLink href={mod.href} />}
                          >
                            <Icon />
                            <span>
                              {formatSidebarMenuLabel(mod.label, notificationCount)}
                            </span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })
                  )}
                </>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarSeparator className="mx-0 w-full" />
      <SidebarFooter className={cn("shrink-0", appChromeFixedZoneBgClassName)}>
        <SidebarMenu className={mobileFooterMenuClassName}>
          {isSuperadmin && !inSuperadmin ? (
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathname.startsWith("/superadmin")}
                tooltip="Superadmin"
                className={mobileFooterButtonClassName}
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
                className={mobileFooterButtonClassName}
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
                isActive={pathname.startsWith(APP_ROUTES.settings.root)}
                tooltip="Einstellungen"
                className={mobileFooterButtonClassName}
                render={<AppNavLink href={APP_ROUTES.settings.root} />}
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
                className={mobileFooterButtonClassName}
                render={<AppNavLink href="/changelog" />}
              >
                <ScrollText />
                <span>
                  {formatSidebarMenuLabel("Changelog", changelogUnreadCount)}
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ) : null}
          <SidebarMenuItem>
            <SidebarMenuButton
              type="button"
              tooltip="Abmelden"
              className={cn(
                "text-sidebar-foreground/80",
                mobileFooterButtonClassName,
              )}
              disabled={isLoggingOut}
              onClick={() => {
                logout();
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
