"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Settings, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { ModuleChipNav } from "@/components/layout/module-subnav";
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
  const { chrome } = useAppModuleChrome();
  const router = useRouter();
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
      <header className="z-30 box-border flex h-[var(--app-chrome-header-h)] min-h-[var(--app-chrome-header-h)] shrink-0 items-center gap-2 border-b border-border/50 bg-app-chrome px-4">
        <SidebarTrigger className="-ml-1 shrink-0" />
        <Separator
          orientation="vertical"
          className="!h-6 shrink-0 self-center data-vertical:!self-center"
        />
        <div className="flex min-w-0 flex-1 items-center gap-2 px-1">
          {chrome.title ? (
            <h1 className="min-w-0 truncate text-left text-base font-semibold tracking-tight text-foreground sm:text-lg">
              {chrome.title}
            </h1>
          ) : (
            <span className="sr-only">App</span>
          )}
          <TestEnvironmentChip />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="icon-sm"
            className="rounded-full border-border/60"
            aria-label="Persönliches Profil"
            render={<Link href="/profile" prefetch />}
          >
            <UserRound className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            className="rounded-full border-border/60"
            aria-label="Einstellungen"
            render={<Link href="/settings" prefetch />}
          >
            <Settings className="size-4" />
          </Button>
          <ModeToggle />
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
            onClick={() => router.back()}
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
        {children}
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
      </AppModuleChromeProvider>
    </SidebarProvider>
  );
}
