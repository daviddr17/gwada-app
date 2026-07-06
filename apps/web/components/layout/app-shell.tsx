"use client";

import * as React from "react";
import Link from "next/link";
import { Settings, UserRound } from "lucide-react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { WorkspaceZoneTransition } from "@/components/layout/workspace-zone-transition";
import { ModuleChipNav } from "@/components/layout/module-subnav";
import { AppChromeCenterFavicon } from "@/components/layout/app-chrome-center-favicon";
import { AppChromeNotificationBell } from "@/components/layout/app-chrome-notification-bell";
import { AppChromeRestaurantProfileLink } from "@/components/layout/app-chrome-restaurant-profile-link";
import { DashboardUploadOverlay } from "@/components/layout/dashboard-upload-overlay";
import { TestEnvironmentChip } from "@/components/layout/test-environment-chip";
import { ModeToggle } from "@/components/theme/mode-toggle";
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
import { appChromeFixedZoneBgClassName } from "@/lib/ui/app-chrome-fixed-zone";
import { APP_ROUTES } from "@/lib/navigation/app-routes";
import { cn } from "@/lib/utils";

function AppInsetWithChrome({ children }: { children: React.ReactNode }) {
  const { chrome } = useAppModuleChrome();
  const showChipRow = Boolean(chrome.subnav?.items.length);

  React.useLayoutEffect(() => {
    if (!showChipRow) {
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
  }, [showChipRow, chrome.subnav]);

  return (
    <SidebarInset className="min-w-0">
      <header
        data-app-chrome-header
        className={cn(
          "z-30 flex box-border h-[var(--app-chrome-header-h)] max-h-[var(--app-chrome-header-h)] min-h-[var(--app-chrome-header-h)] min-w-0 shrink-0 overflow-hidden border-b border-border/50",
          appChromeFixedZoneBgClassName,
        )}
      >
        <div className="flex shrink-0 items-center gap-4 ps-4">
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
            <div className="flex shrink-0 items-center gap-2">
              <AppChromeNotificationBell />
              <AppChromeRestaurantProfileLink />
              <Button
                variant="outline"
                size="icon-sm"
                className="shrink-0 rounded-full border-border/60"
                aria-label="Profil"
                render={<Link href={APP_ROUTES.profile.root} prefetch />}
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
              <ModeToggle size="icon-sm" />
            </div>
          </div>
        </div>
      </header>

      {showChipRow && chrome.subnav ? (
        <div
          data-module-chip-sticky
          className="z-20 flex min-h-12 w-full shrink-0 items-center border-b border-border/50 bg-app-chrome px-1.5 py-2"
          role="navigation"
        >
          <ModuleChipNav
            items={chrome.subnav.items}
            aria-label={chrome.subnav.ariaLabel}
            className="min-w-0 flex-1"
          />
        </div>
      ) : null}

      <div
        data-app-scroll-root
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain"
      >
        <WorkspaceZoneTransition>{children}</WorkspaceZoneTransition>
      </div>
    </SidebarInset>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppModuleChromeProvider>
        <AppSidebar />
        <AppInsetWithChrome>{children}</AppInsetWithChrome>
        <DashboardUploadOverlay />
      </AppModuleChromeProvider>
    </SidebarProvider>
  );
}
