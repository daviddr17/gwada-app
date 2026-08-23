"use client";

import * as React from "react";
import { Outlet } from "@tanstack/react-router";
import { AppMobileBottomNav } from "@/components/layout/app-mobile-bottom-nav";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { ModuleChipNav } from "@/components/layout/module-subnav";
import { AppChromeCenterFavicon } from "@/components/layout/app-chrome-center-favicon";
import { AppChromeNotificationBell } from "@/components/layout/app-chrome-notification-bell";
import { AuthLogoutTransitionProvider } from "@/components/auth/auth-logout-transition-provider";
import { TestEnvironmentChip } from "@/components/layout/test-environment-chip";
import { ModeToggle } from "@/components/theme/mode-toggle";
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
import { appChromeFixedZoneBgClassName } from "@/lib/ui/app-chrome-fixed-zone";
import { cn } from "@/lib/utils";
import { SpaZoneNavigationBridge } from "@/lib/navigation/spa-zone-navigation-bridge";
import { SoftNavLockProvider } from "../shims/soft-nav-lock-provider";
import { SuperadminSpaPendingChromeSync } from "./superadmin-spa-pending-chrome-sync";

function SuperadminSpaInset() {
  const { chrome } = useAppModuleChrome();
  const showChipRow = Boolean(chrome.subnav?.items.length);
  const showSecondaryChipRow = Boolean(chrome.secondarySubnav?.items.length);
  const showChipStrip = showChipRow || showSecondaryChipRow;

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
    if (!el) return;
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
        <div className="hidden shrink-0 items-center gap-4 ps-4 md:flex">
          <SidebarTrigger className="-ms-1 shrink-0" />
          <Separator
            orientation="vertical"
            className="!h-7 shrink-0 self-center bg-border/50 data-vertical:!self-center"
          />
        </div>
        <div className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex h-full w-max min-w-full items-center gap-2 ps-4 sm:gap-3">
            <div className="flex shrink-0 items-center gap-2">
              {chrome.title ? (
                <h1 className="whitespace-nowrap text-left text-base font-semibold tracking-tight text-foreground sm:text-lg">
                  {chrome.title}
                </h1>
              ) : (
                <span className="sr-only">Superadmin</span>
              )}
              <TestEnvironmentChip />
            </div>
            <div className="min-w-4 flex-1 basis-0 shrink-[2]" aria-hidden />
            <AppChromeCenterFavicon />
            <div className="min-w-4 flex-1 basis-0 shrink-[2]" aria-hidden />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 pe-3 ps-1 sm:gap-2 sm:pe-6">
          {chrome.headerActions ? (
            <div className="flex shrink-0 items-center gap-1.5">
              {chrome.headerActions}
            </div>
          ) : null}
          <div className="hidden shrink-0 items-center gap-2 md:flex">
            <AppChromeNotificationBell />
            <ModeToggle size="icon-sm" />
          </div>
          <div className="flex shrink-0 items-center gap-1.5 md:hidden">
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
        <div className="relative z-[1] min-h-full">
          <Outlet />
        </div>
      </div>

      <AppMobileBottomNav />
    </SidebarInset>
  );
}

/** Superadmin-Shell ohne Keep-alive / Soft-Nav-Overlay — TanStack Router SPA. */
export function SuperadminSpaShell() {
  return (
    <SoftNavLockProvider>
      <SpaZoneNavigationBridge base="/superadmin">
        <SidebarProvider>
          <AuthLogoutTransitionProvider>
            <AppModuleChromeProvider>
              <SuperadminSpaPendingChromeSync />
              <AppSidebar />
              <SuperadminSpaInset />
            </AppModuleChromeProvider>
          </AuthLogoutTransitionProvider>
        </SidebarProvider>
      </SpaZoneNavigationBridge>
    </SoftNavLockProvider>
  );
}
