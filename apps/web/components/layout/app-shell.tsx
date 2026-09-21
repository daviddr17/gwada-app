"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Settings, UserRound } from "lucide-react";
import { AppBrandedBackground } from "@/components/layout/app-branded-background";
import { AppMobileBottomNav } from "@/components/layout/app-mobile-bottom-nav";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { WorkspaceZoneTransition } from "@/components/layout/workspace-zone-transition";
import { ModuleChipNav } from "@/components/layout/module-subnav";
import { AppChromeCenterFavicon } from "@/components/layout/app-chrome-center-favicon";
import { AppChromeActivityFeed } from "@/components/layout/app-chrome-activity-feed";
import { AppChromeCalendar } from "@/components/layout/app-chrome-calendar";
import { AppChromeNotificationBell } from "@/components/layout/app-chrome-notification-bell";
import { AppChromeRestaurantProfileLink } from "@/components/layout/app-chrome-restaurant-profile-link";
import { AppChromeOpsStatus } from "@/components/ops/app-chrome-ops-status";
import { DashboardPwaInstallButton } from "@/components/dashboard/dashboard-pwa-install-button";
import { AuthLogoutTransitionProvider } from "@/components/auth/auth-logout-transition-provider";
import { DashboardUploadOverlay } from "@/components/layout/dashboard-upload-overlay";
import { TestEnvironmentChip } from "@/components/layout/test-environment-chip";
import { ModeToggle } from "@/components/theme/mode-toggle";
import { AppNavLink } from "@/components/navigation/app-nav-link";
import { SoftNavPendingOverlay } from "@/components/navigation/soft-nav-pending-overlay";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  AppModuleChromeProvider,
  useAppModuleChrome,
} from "@/lib/contexts/app-module-chrome-context";
import {
  DashboardGlobalSearchChrome,
  DashboardGlobalSearchTrigger,
} from "@/components/search/dashboard-global-search-chrome";
import {
  appChromeFixedZoneBgClassName,
  appChromeSafeEndClassName,
  appChromeSafeStartClassName,
} from "@/lib/ui/app-chrome-fixed-zone";
import { APP_ROUTES } from "@/lib/navigation/app-routes";
import { isRestaurantDashboardPath } from "@/lib/contexts/dashboard-global-search-context";
import { useAccentColor } from "@/lib/contexts/accent-color-context";
import { cn } from "@/lib/utils";

function AppInsetWithChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const { accentHex } = useAccentColor();
  const { chrome } = useAppModuleChrome();
  const showChipRow = Boolean(chrome.subnav?.items.length);
  const showSecondaryChipRow =
    Boolean(chrome.secondarySubnav?.items.length) ||
    Boolean(chrome.secondarySubnavContent);
  const showChipStrip = showChipRow || showSecondaryChipRow;
  const showDashboardBrandedBackground = isRestaurantDashboardPath(pathname);
  const headerRef = React.useRef<HTMLElement>(null);
  const centerRef = React.useRef<HTMLDivElement>(null);
  const titleGroupRef = React.useRef<HTMLDivElement>(null);
  const titleRef = React.useRef<HTMLHeadingElement>(null);
  const logoSlotRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLDivElement>(null);
  const rightClusterRef = React.useRef<HTMLDivElement>(null);
  const savedTriggerWidthRef = React.useRef(0);
  const savedRightWidthRef = React.useRef(0);
  const savedTitleWidthRef = React.useRef(0);
  const [compactTools, setCompactTools] = React.useState(false);

  React.useLayoutEffect(() => {
    const header = headerRef.current;
    const center = centerRef.current;
    if (!header || !center) return;

    const desktopQuery = window.matchMedia("(min-width: 768px)");

    const measure = () => {
      if (!desktopQuery.matches) {
        setCompactTools(false);
        return;
      }

      const titleWidth = Math.max(
        titleRef.current?.scrollWidth ?? 0,
        titleGroupRef.current?.scrollWidth ?? 0,
        compactTools ? savedTitleWidthRef.current : 0,
      );
      if (!compactTools && titleWidth > 0) {
        savedTitleWidthRef.current = titleWidth;
      }
      const logoWidth = logoSlotRef.current?.offsetWidth ?? 0;
      const minCenter = titleWidth + 40 + logoWidth;
      const style = getComputedStyle(center);
      const pad =
        (Number.parseFloat(style.paddingLeft) || 0) +
        (Number.parseFloat(style.paddingRight) || 0);
      const triggerWidth = triggerRef.current?.offsetWidth ?? 0;
      const rightWidth = rightClusterRef.current?.offsetWidth ?? 0;
      if (!compactTools && triggerWidth > 0) {
        savedTriggerWidthRef.current = triggerWidth;
      }
      if (!compactTools && rightWidth > 0) {
        savedRightWidthRef.current = rightWidth;
      }

      if (!compactTools) {
        const available = center.clientWidth - pad;
        if (minCenter > available + 1) setCompactTools(true);
        return;
      }

      const availableIfFull =
        header.clientWidth -
        savedTriggerWidthRef.current -
        savedRightWidthRef.current -
        pad;
      if (minCenter + 32 <= availableIfFull) setCompactTools(false);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    observer.observe(center);
    if (titleGroupRef.current) observer.observe(titleGroupRef.current);
    if (logoSlotRef.current) observer.observe(logoSlotRef.current);
    if (rightClusterRef.current) observer.observe(rightClusterRef.current);
    desktopQuery.addEventListener("change", measure);
    return () => {
      observer.disconnect();
      desktopQuery.removeEventListener("change", measure);
    };
  }, [chrome.title, compactTools]);

  React.useLayoutEffect(() => {
    if (!showChipStrip) {
      document.documentElement.style.removeProperty("--app-module-chip-sticky-h");
      return;
    }
    const measure = () => {
      const el = document.querySelector("[data-module-chip-sticky]");
      const h =
        el instanceof HTMLElement ? el.getBoundingClientRect().height : 0;
      document.documentElement.style.setProperty(
        "--app-module-chip-sticky-h",
        `${h}px`,
      );
    };
    measure();
    const el = document.querySelector("[data-module-chip-sticky]");
    if (!el) {
      return () => {
        document.documentElement.style.removeProperty(
          "--app-module-chip-sticky-h",
        );
      };
    }
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
      document.documentElement.style.removeProperty("--app-module-chip-sticky-h");
    };
  }, [showChipStrip, chrome.subnav, chrome.secondarySubnav, chrome.secondarySubnavContent]);

  return (
    <SidebarInset
      className="group/inset min-w-0"
      data-chrome-compact={compactTools ? "true" : undefined}
    >
      <header
        ref={headerRef}
        data-app-chrome-header
        className={cn(
          "z-30 flex box-border h-[var(--app-chrome-header-h)] max-h-[var(--app-chrome-header-h)] min-h-[var(--app-chrome-header-h)] min-w-0 shrink-0 overflow-hidden border-b border-border/50",
          appChromeFixedZoneBgClassName,
        )}
      >
        {/* Desktop: Sidebar-Trigger; mobil: Bottom-Nav „Menü“ */}
        <div
          ref={triggerRef}
          className={cn(
            "shrink-0 items-center gap-4 ps-4",
            compactTools ? "hidden" : "hidden md:flex",
          )}
        >
          <SidebarTrigger className="-ms-1 shrink-0" />
          <Separator
            orientation="vertical"
            className="!h-7 shrink-0 self-center bg-border/50 data-vertical:!self-center"
          />
        </div>
        <div
          ref={centerRef}
          className={cn(
            "flex h-full min-w-0 flex-1 items-center overflow-hidden",
            appChromeSafeStartClassName,
          )}
        >
          <div
            ref={titleGroupRef}
            className={cn(
              "flex items-center gap-2",
              compactTools ? "min-w-0 shrink overflow-hidden" : "shrink-0",
            )}
          >
            {chrome.title ? (
              <h1
                ref={titleRef}
                className="whitespace-nowrap text-left text-base font-semibold tracking-tight text-foreground sm:text-lg"
                title={chrome.title}
              >
                {chrome.title}
              </h1>
            ) : (
              <span className="sr-only">App</span>
            )}
            <TestEnvironmentChip />
          </div>
          {/* Gleicher Abstand links/rechts hält das Logo mittig, bis zum Titel nur noch 40px bleiben. */}
          <div
            className={cn("min-w-10", compactTools ? "w-10 shrink-0" : "flex-1")}
            aria-hidden
          />
          <div ref={logoSlotRef} className="shrink-0">
            <AppChromeCenterFavicon />
          </div>
          <div className="min-w-0 flex-1" aria-hidden />
        </div>
        {/* Rechts: Kalender global; Modul-Aktionen nur wenn nötig (z. B. Dashboard anordnen) */}
        <div
          ref={rightClusterRef}
          className={cn("flex shrink-0 items-center gap-1.5 ps-1 sm:gap-2", appChromeSafeEndClassName)}
        >
          <AppChromeCalendar />
          {chrome.headerActions ? (
            <div className="flex shrink-0 items-center gap-1.5">
              {chrome.headerActions}
            </div>
          ) : null}
          {/* Desktop-Chrome: Suche, Glocke, Profil, … — mobil in Bottom-Nav / Menü */}
          <div
            className={cn(
              "shrink-0 items-center gap-2",
              compactTools ? "hidden" : "hidden md:flex",
            )}
          >
            <AppChromeOpsStatus />
            <DashboardGlobalSearchTrigger />
            <AppChromeActivityFeed />
            <AppChromeNotificationBell />
            <AppChromeRestaurantProfileLink />
            <Button
              variant="outline"
              size="icon-sm"
              className="shrink-0 rounded-full border-border/60"
              aria-label="Profil"
              render={<AppNavLink href={APP_ROUTES.profile.personal} />}
            >
              <UserRound className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              className="shrink-0 rounded-full border-border/60"
              aria-label="Einstellungen"
              render={<AppNavLink href={APP_ROUTES.settings.entry} />}
            >
              <Settings className="size-4" />
            </Button>
            <DashboardPwaInstallButton />
            <ModeToggle size="icon-sm" />
          </div>
          {/* Mobil: Theme neben Modul-Aktionen — Live-Verlauf im Bottom-Dock */}
          <div
            className={cn(
              "shrink-0 items-center gap-1.5",
              compactTools ? "flex" : "flex md:hidden",
            )}
          >
            <ModeToggle size="icon-sm" />
          </div>
        </div>
      </header>

      {showChipStrip ? (
        <div data-module-chip-sticky className="z-20 w-full shrink-0">
          {showChipRow && chrome.subnav ? (
            <div
              className="flex min-h-12 w-full items-center border-b border-border/50 bg-app-chrome px-1.5 py-2"
              role="navigation"
            >
              <ModuleChipNav
                items={chrome.subnav.items}
                aria-label={chrome.subnav.ariaLabel}
                className="min-w-0 flex-1"
              />
            </div>
          ) : null}
          {showSecondaryChipRow && chrome.secondarySubnavContent ? (
            <div
              className="flex min-h-12 w-full items-center border-b border-border/50 bg-app-chrome px-1.5 py-2"
            >
              {chrome.secondarySubnavContent}
            </div>
          ) : null}
          {showSecondaryChipRow && chrome.secondarySubnav ? (
            <div
              className="flex min-h-12 w-full items-center border-b border-border/50 bg-app-chrome px-1.5 py-2"
              role="navigation"
            >
              <ModuleChipNav
                items={chrome.secondarySubnav.items}
                aria-label={chrome.secondarySubnav.ariaLabel}
                className="min-w-0 flex-1"
              />
            </div>
          ) : null}
        </div>
      ) : null}

      <div data-app-chrome-footer-host className="relative min-h-0 flex-1">
        {showDashboardBrandedBackground ? (
          <div
            className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
            aria-hidden
          >
            <AppBrandedBackground accentHex={accentHex} intensity="hint" />
          </div>
        ) : null}
        <div
          data-app-scroll-root
          className="relative z-[1] h-full min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain [-webkit-overflow-scrolling:touch]"
        >
          <div className="relative h-full min-h-full">
            <WorkspaceZoneTransition>
              {children}
            </WorkspaceZoneTransition>
          </div>
        </div>
        {/* Soft-Nav Pending — Keep-alive Homes nur in DashboardSpaShell */}
        <SoftNavPendingOverlay />
      </div>

      <AppMobileBottomNav />
    </SidebarInset>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AuthLogoutTransitionProvider>
        <AppModuleChromeProvider>
          <DashboardGlobalSearchChrome>
            <AppSidebar />
            <AppInsetWithChrome>{children}</AppInsetWithChrome>
            <DashboardUploadOverlay />
          </DashboardGlobalSearchChrome>
        </AppModuleChromeProvider>
      </AuthLogoutTransitionProvider>
    </SidebarProvider>
  );
}
