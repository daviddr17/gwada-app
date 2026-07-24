"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings, UserRound } from "lucide-react";
import { AppBrandedBackground } from "@/components/layout/app-branded-background";
import { AppMobileBottomNav } from "@/components/layout/app-mobile-bottom-nav";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { WorkspaceZoneTransition } from "@/components/layout/workspace-zone-transition";
import { ModuleChipNav } from "@/components/layout/module-subnav";
import { AppChromeCenterFavicon } from "@/components/layout/app-chrome-center-favicon";
import { AppChromeNotificationBell } from "@/components/layout/app-chrome-notification-bell";
import { AppChromeRestaurantProfileLink } from "@/components/layout/app-chrome-restaurant-profile-link";
import { DashboardPwaInstallButton } from "@/components/dashboard/dashboard-pwa-install-button";
import { AuthLogoutTransitionProvider } from "@/components/auth/auth-logout-transition-provider";
import { DashboardUploadOverlay } from "@/components/layout/dashboard-upload-overlay";
import { TestEnvironmentChip } from "@/components/layout/test-environment-chip";
import { ModeToggle } from "@/components/theme/mode-toggle";
import { AppNavLink } from "@/components/navigation/app-nav-link";
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
import { appChromeFixedZoneBgClassName } from "@/lib/ui/app-chrome-fixed-zone";
import { APP_ROUTES } from "@/lib/navigation/app-routes";
import { useAccentColor } from "@/lib/contexts/accent-color-context";
import { cn } from "@/lib/utils";

function isRestaurantDashboardPath(pathname: string): boolean {
  return (
    pathname === APP_ROUTES.dashboard ||
    pathname.startsWith(`${APP_ROUTES.dashboard}/`)
  );
}

function AppInsetWithChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { accentHex } = useAccentColor();
  const { chrome } = useAppModuleChrome();
  const showChipRow = Boolean(chrome.subnav?.items.length);
  const showSecondaryChipRow = Boolean(chrome.secondarySubnav?.items.length);
  const showChipStrip = showChipRow || showSecondaryChipRow;
  const showDashboardBrandedBackground = isRestaurantDashboardPath(pathname);

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
  }, [showChipStrip, chrome.subnav, chrome.secondarySubnav]);

  return (
    <SidebarInset className="min-w-0">
      <header
        data-app-chrome-header
        className={cn(
          "z-30 flex box-border h-[var(--app-chrome-header-h)] max-h-[var(--app-chrome-header-h)] min-h-[var(--app-chrome-header-h)] min-w-0 shrink-0 overflow-hidden border-b border-border/50",
          appChromeFixedZoneBgClassName,
        )}
      >
        {/* Desktop: Sidebar-Trigger; mobil: Bottom-Nav „Menü“ */}
        <div className="hidden shrink-0 items-center gap-4 ps-4 md:flex">
          <SidebarTrigger className="-ms-1 shrink-0" />
          <Separator
            orientation="vertical"
            className="!h-7 shrink-0 self-center bg-border/50 data-vertical:!self-center"
          />
        </div>
        <div className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex h-full w-max min-w-full items-center gap-2 ps-4 pe-4 sm:gap-3 sm:pe-6">
            <div className="flex shrink-0 items-center gap-2">
              {chrome.title ? (
                <h1 className="whitespace-nowrap text-left text-base font-semibold tracking-tight text-foreground sm:text-lg">
                  {chrome.title}
                </h1>
              ) : (
                <span className="sr-only">App</span>
              )}
              <TestEnvironmentChip />
            </div>
            <div className="min-w-4 flex-1 basis-0 shrink-[2]" aria-hidden />
            <AppChromeCenterFavicon />
            <div className="min-w-4 flex-1 basis-0 shrink-[2]" aria-hidden />
            {/* Desktop-Chrome: Suche, Glocke, Profil, … — mobil in Bottom-Nav / Menü */}
            <div className="hidden shrink-0 items-center gap-2 md:flex">
              <DashboardGlobalSearchTrigger />
              <AppChromeNotificationBell />
              <AppChromeRestaurantProfileLink />
              <Button
                variant="outline"
                size="icon-sm"
                className="shrink-0 rounded-full border-border/60"
                aria-label="Profil"
                render={<AppNavLink href={APP_ROUTES.profile.personal} prefetch />}
              >
                <UserRound className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                className="shrink-0 rounded-full border-border/60"
                aria-label="Einstellungen"
                render={<Link href={APP_ROUTES.settings.root} prefetch />}
              >
                <Settings className="size-4" />
              </Button>
              <DashboardPwaInstallButton />
              <ModeToggle size="icon-sm" />
            </div>
            {/* Mobil: nur Theme — Rest in Bottom-Nav / Vollbild-Menü */}
            <div className="flex shrink-0 items-center gap-2 md:hidden">
              <ModeToggle size="icon-sm" />
            </div>
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

      <div
        data-app-scroll-root
        className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain"
      >
        {showDashboardBrandedBackground ? (
          <div
            className="pointer-events-none sticky top-0 z-0 -mb-[100dvh] h-dvh w-full overflow-hidden"
            aria-hidden
          >
            <AppBrandedBackground accentHex={accentHex} intensity="hint" />
          </div>
        ) : null}
        <div className="relative z-[1]">
          <WorkspaceZoneTransition>
            {children}
          </WorkspaceZoneTransition>
        </div>
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
