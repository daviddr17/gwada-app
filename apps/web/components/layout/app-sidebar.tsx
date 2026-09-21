"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SidebarModuleUpsellOverlay } from "@/components/billing/sidebar-module-upsell-overlay";
import { AppNavLink } from "@/components/navigation/app-nav-link";
import { WhatsAppGlyph } from "@/components/icons/whatsapp-glyph";
import { usePathname } from "next/navigation";
import { useAuthLogoutTransition } from "@/components/auth/auth-logout-transition-provider";
import {
  isSidebarDashboardActive,
  isSidebarModuleActive,
} from "@/lib/navigation/sidebar-active";
import { useSoftNavLock } from "@/components/providers/soft-nav-lock-provider";
import {
  Activity,
  Bell,
  Building2,
  CreditCard,
  Hourglass,
  LayoutDashboard,
  Lock,
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
  UserRound,
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
import { formatSidebarMenuLabel } from "@/lib/navigation/format-sidebar-menu-label";
import {
  sidebarChangelogUnreadCount,
  sidebarModuleNotificationCount,
} from "@/lib/navigation/sidebar-module-notification-counts";
import { useNotificationSummary } from "@/lib/hooks/use-notification-summary";
import { useRestaurantBilling } from "@/lib/contexts/restaurant-billing-context";
import { useRestaurantPermissions } from "@/lib/hooks/use-restaurant-permissions";
import {
  hasSidebarModulePermissionAccess,
  isSidebarModuleBillingLocked,
} from "@/lib/permissions/sidebar-module-permissions";
import { useSuperadminChangelogPendingCount } from "@/lib/hooks/use-superadmin-changelog-pending-count";
import { useVerticalScrollOverflow } from "@/lib/hooks/use-vertical-scroll-overflow";
import { appChromeFixedZoneBgClassName } from "@/lib/ui/app-chrome-fixed-zone";
import {
  appMobileSidebarFooterClassName,
  appMobileSidebarFooterMenuButtonClassName,
  appMobileSidebarFooterMenuClassName,
  appMobileSidebarGroupClassName,
  appMobileSidebarHeaderButtonClassName,
  appMobileSidebarModuleGroupContentClassName,
} from "@/lib/ui/app-mobile-sidebar-menu";
import { SidebarScrollOverflowHints } from "@/components/layout/sidebar-scroll-overflow-hints";
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

export function AppSidebar() {
  const pathname = usePathname() ?? "";
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
  const { entitlements } = useRestaurantBilling();
  const [upsellModuleId, setUpsellModuleId] = useState<SidebarModuleId | null>(
    null,
  );
  const permissionsPending = permissionsLoading && permissions.size === 0;
  const inSuperadmin = pathname.startsWith("/superadmin");
  const { summary: notificationSummary } = useNotificationSummary();
  const { count: pendingChangelogCount } = useSuperadminChangelogPendingCount(
    isSuperadmin && inSuperadmin,
  );
  const changelogUnreadCount = sidebarChangelogUnreadCount(notificationSummary);

  const orderedSidebarModules = useMemo(() => {
    const mods = sidebarModuleOrder
      .map((id: SidebarModuleId) => SIDEBAR_MODULE_BY_ID.get(id))
      .filter((mod): mod is NonNullable<typeof mod> => mod != null);
    // Permissions noch leer: Module trotzdem sofort sichtbar (optimistic).
    // Billing-Gesperrte bleiben sichtbar (ausgegraut + Schloss → Abo).
    if (permissionsPending) {
      return mods.map((mod) => ({ mod, billingLocked: false }));
    }
    return mods
      .filter((mod) => hasSidebarModulePermissionAccess(has, mod.id))
      .map((mod) => ({
        mod,
        billingLocked: isSidebarModuleBillingLocked(entitlements, mod.id, {
          isSuperadmin,
        }),
      }));
  }, [
    sidebarModuleOrder,
    has,
    permissionsPending,
    entitlements,
    isSuperadmin,
  ]);

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

  // Menü erst nach Pending/Pathname schließen — nie sync im Link-click.
  // Sync-Close startet Sheet-Dismiss und unmountet den geklickten <a> bevor
  // der Next-Flight steht → Kaltstart mobil: „Tippen tut nichts“.
  useEffect(() => {
    if (!isMobile) return;
    setOpenMobile(false);
  }, [pathname, isMobile, setOpenMobile]);

  useEffect(() => {
    if (!isMobile || !pendingHref) return;
    setOpenMobile(false);
  }, [pendingHref, isMobile, setOpenMobile]);

  const mobileFooterMenuClassName = isMobile
    ? appMobileSidebarFooterMenuClassName
    : "gap-1.5";
  const mobileFooterButtonClassName = isMobile
    ? appMobileSidebarFooterMenuButtonClassName
    : undefined;

  const {
    ref: moduleListScrollRef,
    canScrollUp: moduleListCanScrollUp,
    canScrollDown: moduleListCanScrollDown,
    scrollByPage: scrollModuleListByPage,
  } = useVerticalScrollOverflow();

  return (
    <Sidebar collapsible="icon" variant="inset">
      <div className="flex h-full w-full flex-col">
      <SidebarHeader
        className={cn(
          "box-border flex shrink-0 justify-center gap-0 border-b border-border/50 p-2",
          isMobile
            ? "h-auto min-h-0"
            : "h-[var(--app-chrome-header-h)] min-h-[var(--app-chrome-header-h)]",
          appChromeFixedZoneBgClassName,
        )}
      >
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="default"
              tooltip={headerTooltip}
              render={<Link href="/workspace/restaurants" prefetch />}
              className={cn(
                isMobile && appMobileSidebarHeaderButtonClassName,
                "!p-0 [--sidebar-menu-icon-col:2rem] grid-cols-[2rem_minmax(0,1fr)] group-data-[sidebar-labels-collapsed]/sidebar-wrapper:grid-cols-[2rem_0fr]",
                !isMobile && "ms-[5px]",
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
                    className="block h-3 w-[4.5rem] max-w-full rounded-md bg-sidebar-accent/50 skeleton-shimmer"
                    aria-hidden
                  />
                )}
                {displayName ? (
                  <span className="truncate text-[10px] text-sidebar-foreground/70">
                    {displayName}
                  </span>
                ) : profileReady ? null : (
                  <span
                    className="mt-0.5 block h-2 w-16 max-w-full rounded-md bg-sidebar-accent/40 skeleton-shimmer"
                    aria-hidden
                  />
                )}
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <div className="relative flex min-h-0 flex-1 flex-col">
      <SidebarContent
        ref={moduleListScrollRef}
        className="flex min-h-0 flex-1 flex-col gap-2"
      >
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
                      render={<AppNavLink href="/superadmin/allgemein" />}
                    >
                      <Settings2 />
                      <span>Allgemein</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={pathname.startsWith("/superadmin/users")}
                      tooltip="User"
                      render={<AppNavLink href="/superadmin/users" />}
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
                      render={<AppNavLink href="/superadmin/restaurants" />}
                    >
                      <Building2 />
                      <span>Restaurants</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={pathname.startsWith(
                        "/superadmin/abonnements",
                      )}
                      tooltip="Abonnements"
                      render={<AppNavLink href="/superadmin/abonnements" />}
                    >
                      <CreditCard />
                      <span>Abonnements</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={pathname.startsWith("/superadmin/warteliste")}
                      tooltip="Warteliste"
                      render={<AppNavLink href="/superadmin/warteliste" />}
                    >
                      <Hourglass />
                      <span>Warteliste</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={pathname.startsWith("/superadmin/newsletter")}
                      tooltip="Newsletter"
                      render={<AppNavLink href="/superadmin/newsletter" />}
                    >
                      <Mail />
                      <span>Newsletter</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={pathname.startsWith("/superadmin/integrationen")}
                      tooltip="Integrationen"
                      render={<AppNavLink href="/superadmin/integrationen" />}
                    >
                      <Plug />
                      <span>Integrationen</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={pathname.startsWith("/superadmin/waha")}
                      tooltip="WAHA"
                      render={<AppNavLink href="/superadmin/waha" />}
                    >
                      <WhatsAppGlyph className="size-4 [&_path]:fill-current" />
                      <span>WAHA</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={pathname.startsWith("/superadmin/ops")}
                      tooltip="Ops"
                      render={<AppNavLink href="/superadmin/ops" />}
                    >
                      <Activity />
                      <span>Ops</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={isSuperadminSystemPath(pathname)}
                      tooltip="System"
                      render={<AppNavLink href={SUPERADMIN_SYSTEM_ROUTES.datenbank} />}
                    >
                      <Server />
                      <span>System</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={pathname.startsWith("/superadmin/design")}
                      tooltip="Design"
                      render={<AppNavLink href="/superadmin/design" />}
                    >
                      <Palette />
                      <span>Design</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={pathname.startsWith(SUPERADMIN_VORLAGEN_ROUTES.root)}
                      tooltip="Vorlagen"
                      render={<AppNavLink href={SUPERADMIN_VORLAGEN_ROUTES.vertragsvorlagen} />}
                    >
                      <Files />
                      <span>Vorlagen</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={pathname.startsWith("/superadmin/changelog")}
                      tooltip="Changelog"
                      render={<AppNavLink href="/superadmin/changelog" />}
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
                        "/superadmin/benachrichtigungen",
                      )}
                      tooltip="Benachrichtigungen"
                      render={<AppNavLink href="/superadmin/benachrichtigungen" />}
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
                      isActive={isSidebarDashboardActive(pathname, pendingHref)}
                      tooltip="Dashboard"
                      render={<AppNavLink href="/dashboard" />}
                    >
                      <LayoutDashboard />
                      <span>Dashboard</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  {permissionsError &&
                  !permissionsPending &&
                  orderedSidebarModules.length === 0 ? (
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
                    orderedSidebarModules.map(({ mod, billingLocked }) => {
                      const Icon = mod.icon;
                      const notificationCount = billingLocked
                        ? 0
                        : sidebarModuleNotificationCount(
                            notificationSummary,
                            mod.id,
                          );
                      return (
                        <SidebarMenuItem key={mod.id}>
                          <SidebarMenuButton
                            isActive={
                              !billingLocked &&
                              isSidebarModuleActive(pathname, pendingHref, mod)
                            }
                            tooltip={
                              billingLocked
                                ? mod.id === "pos"
                                  ? `${mod.tooltip} — Coming soon`
                                  : `${mod.tooltip} — Abo erforderlich`
                                : mod.tooltip
                            }
                            className={
                              billingLocked
                                ? "opacity-55 text-sidebar-foreground/55 hover:opacity-70 hover:text-sidebar-foreground/70"
                                : undefined
                            }
                            render={
                              billingLocked ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setUpsellModuleId(mod.id);
                                    if (isMobile) setOpenMobile(false);
                                  }}
                                />
                              ) : (
                                <AppNavLink href={mod.href} />
                              )
                            }
                          >
                            <Icon />
                            <span className="flex min-w-0 items-center gap-1.5">
                              <span className="truncate">
                                {formatSidebarMenuLabel(
                                  mod.label,
                                  notificationCount,
                                )}
                              </span>
                              {billingLocked ? (
                                <Lock
                                  className="size-3.5 shrink-0 opacity-80"
                                  aria-hidden
                                />
                              ) : null}
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
      <SidebarScrollOverflowHints
        canScrollUp={moduleListCanScrollUp}
        canScrollDown={moduleListCanScrollDown}
        onScrollUp={() => scrollModuleListByPage("up")}
        onScrollDown={() => scrollModuleListByPage("down")}
      />
      </div>
      {isMobile ? null : <SidebarSeparator className="mx-0 w-full" />}
      <SidebarFooter
        className={cn(
          "shrink-0",
          appChromeFixedZoneBgClassName,
          isMobile && appMobileSidebarFooterClassName,
        )}
      >
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
                isActive={isSidebarDashboardActive(pathname, pendingHref)}
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
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={pathname.startsWith(APP_ROUTES.profile.root)}
              tooltip="Profil"
              className={mobileFooterButtonClassName}
              render={<AppNavLink href={APP_ROUTES.profile.personal} />}
            >
              <UserRound />
              <span>Profil</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {!inSuperadmin ? (
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathname.startsWith(APP_ROUTES.settings.root)}
                tooltip="Einstellungen"
                className={mobileFooterButtonClassName}
                render={<AppNavLink href={APP_ROUTES.settings.entry} />}
              >
                <Settings />
                <span>Einstellungen</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ) : null}
          {!inSuperadmin ? (
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathname.startsWith(APP_ROUTES.changelog)}
                tooltip="Changelog"
                className={mobileFooterButtonClassName}
                render={<AppNavLink href={APP_ROUTES.changelog} />}
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
      <SidebarModuleUpsellOverlay
        moduleId={upsellModuleId}
        onClose={() => setUpsellModuleId(null)}
      />
    </Sidebar>
  );
}
