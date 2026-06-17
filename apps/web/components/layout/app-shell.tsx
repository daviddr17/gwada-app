"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Settings, UserRound } from "lucide-react";
import { useModuleSubnavBack } from "@/lib/hooks/use-module-subnav-back";
import { crossAppModuleNavigation } from "@/lib/navigation/app-module-navigation";
import { assignCrossAppWorkspaceZone } from "@/lib/navigation/app-zone-navigation";
import { useSoftNavLock } from "@/components/providers/soft-nav-lock-provider";
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

function AppInsetWithChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { chrome } = useAppModuleChrome();
  const { backHref, onBackNavigate } = useModuleSubnavBack(chrome.subnav?.items);
  const { tryAcquireNavLock } = useSoftNavLock();
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
        className="z-30 flex box-border h-[var(--app-chrome-header-h)] max-h-[var(--app-chrome-header-h)] min-h-[var(--app-chrome-header-h)] min-w-0 shrink-0 overflow-hidden border-b border-border/50 bg-app-chrome"
      >
        <div className="flex shrink-0 items-center ps-4 pe-2">
          <SidebarTrigger className="-ms-1 shrink-0" />
        </div>
        <div className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex h-full w-max min-w-full items-center gap-2 px-2 pe-4 sm:gap-3 sm:px-4">
            <Separator
              orientation="vertical"
              className="!h-6 shrink-0 self-center data-vertical:!self-center"
            />
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
            <div
              className="min-w-4 flex-1 basis-0 shrink-[2]"
              aria-hidden
            />
            <AppChromeCenterFavicon />
            <div
              className="min-w-4 flex-1 basis-0 shrink-[2]"
              aria-hidden
            />
            <div className="flex shrink-0 items-center gap-2">
              <AppChromeNotificationBell />
              <AppChromeRestaurantProfileLink />
              <Button
                variant="outline"
                size="icon-sm"
                className="shrink-0 rounded-full border-border/60"
                aria-label="Profil"
                render={<Link href="/profile" prefetch />}
              >
                <UserRound className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                className="shrink-0 rounded-full border-border/60"
                aria-label="Einstellungen"
                render={<Link href="/settings" prefetch />}
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
          className="z-20 flex min-h-12 w-full shrink-0 items-center gap-2 border-b border-border/50 bg-app-chrome px-4 py-2 sm:px-6"
          role="navigation"
        >
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="Zurück zur letzten Seite"
            nativeButton={false}
            render={
              <Link
                href={backHref}
                prefetch={false}
                scroll={false}
                onClick={(event) => {
                  onBackNavigate();
                  if (assignCrossAppWorkspaceZone(pathname, backHref)) {
                    event.preventDefault();
                    return;
                  }
                  if (
                    crossAppModuleNavigation(pathname, backHref) &&
                    !tryAcquireNavLock(event)
                  ) {
                    return;
                  }
                }}
              />
            }
          >
            <ArrowLeft className="size-4" />
          </Button>
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
