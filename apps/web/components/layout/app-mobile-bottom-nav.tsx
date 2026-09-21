"use client";

import { useEffect, useRef } from "react";
import { Menu, Search, X } from "lucide-react";
import { AppChromeActivityFeed } from "@/components/layout/app-chrome-activity-feed";
import { AppChromeNotificationBell } from "@/components/layout/app-chrome-notification-bell";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { useAppShellReadiness } from "@/components/providers/app-shell-readiness-provider";
import {
  isRestaurantDashboardPath,
  useDashboardGlobalSearchOptional,
} from "@/lib/contexts/dashboard-global-search-context";
import { appChromeFixedZoneBgClassName } from "@/lib/ui/app-chrome-fixed-zone";
import {
  APP_MOBILE_BOTTOM_NAV_BAR_H,
  appMobileBottomSafePbClassName,
} from "@/lib/ui/app-mobile-bottom-nav";
import { APP_LAYER_Z_INDEX } from "@/lib/ui/app-layer-z-index";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";

const itemClassName =
  "flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-none text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground";

const itemActiveClassName = "text-foreground";

/** Nach Soft-Nav-Close: Dock darf Menü nicht sofort wieder aufklappen. */
const MENU_REOPEN_COOLDOWN_MS = 480;

/**
 * Mobile Primary-Nav: Menü · Suche · Live · Meldungen (Thumb-Zone).
 * Profil in der Menü-Footer-Zeile (Superadmin, Einstellungen, …).
 * Desktop: nicht gerendert (`md:hidden`).
 */
export function AppMobileBottomNav() {
  const pathname = usePathname();
  const { dismissBootstrap } = useAppShellReadiness();
  const { openMobile, setOpenMobile } = useSidebar();
  const wasOpenRef = useRef(openMobile);
  const reopenBlockedUntilRef = useRef(0);
  const search = useDashboardGlobalSearchOptional();
  const showSearch = isRestaurantDashboardPath(pathname) && Boolean(search);
  const searchOpen = Boolean(search?.open);

  useEffect(() => {
    if (wasOpenRef.current && !openMobile) {
      reopenBlockedUntilRef.current = Date.now() + MENU_REOPEN_COOLDOWN_MS;
    }
    if (!wasOpenRef.current && openMobile) {
      dismissBootstrap();
    }
    wasOpenRef.current = openMobile;
  }, [openMobile, dismissBootstrap]);

  return (
    <nav
      data-app-mobile-bottom-nav
      aria-label="Hauptnavigation"
      className={cn(
        "fixed inset-x-0 bottom-0 border-t border-border/50 md:hidden",
        "ps-[env(safe-area-inset-left,0px)] pe-[env(safe-area-inset-right,0px)]",
        appChromeFixedZoneBgClassName,
        appMobileBottomSafePbClassName,
      )}
      style={{ zIndex: APP_LAYER_Z_INDEX.mobileBottomNav }}
    >
      <div
        className="flex items-stretch"
        style={{ height: APP_MOBILE_BOTTOM_NAV_BAR_H }}
      >
        <Button
          type="button"
          variant="ghost"
          className={cn(itemClassName, openMobile && itemActiveClassName)}
          aria-label={openMobile ? "Menü schließen" : "Menü öffnen"}
          aria-expanded={openMobile}
          onClick={() => {
            if (searchOpen) search?.closeSearch();
            if (openMobile) {
              setOpenMobile(false);
              return;
            }
            if (Date.now() < reopenBlockedUntilRef.current) {
              return;
            }
            if (
              document.querySelector(
                '[data-app-mobile-chrome-overlay][data-open="false"]',
              )
            ) {
              return;
            }
            setOpenMobile(true);
          }}
        >
          {openMobile ? (
            <X className="size-5 shrink-0" aria-hidden />
          ) : (
            <Menu className="size-5 shrink-0" aria-hidden />
          )}
          <span>Menü</span>
        </Button>

        {showSearch ? (
          <Button
            type="button"
            variant="ghost"
            className={cn(itemClassName, searchOpen && itemActiveClassName)}
            aria-label={searchOpen ? "Suche schließen" : "Suche öffnen"}
            aria-expanded={searchOpen}
            onClick={() => {
              if (searchOpen) {
                search?.closeSearch();
                return;
              }
              setOpenMobile(false);
              search?.openSearch();
            }}
          >
            {searchOpen ? (
              <X className="size-5 shrink-0" aria-hidden />
            ) : (
              <Search className="size-5 shrink-0" aria-hidden />
            )}
            <span>Suche</span>
          </Button>
        ) : (
          <span className={cn(itemClassName, "pointer-events-none opacity-40")}>
            <Search className="size-5 shrink-0" aria-hidden />
            <span>Suche</span>
          </span>
        )}

        <div className="flex min-w-0 flex-1 items-stretch justify-center">
          <AppChromeActivityFeed
            className={cn(itemClassName, "h-full w-full")}
            labelClassName="text-[10px] font-medium"
            variant="mobileNav"
            showLabel
            onBeforeOpen={() => {
              setOpenMobile(false);
              if (searchOpen) search?.closeSearch();
            }}
          />
        </div>

        <div className="flex min-w-0 flex-1 items-stretch justify-center">
          <AppChromeNotificationBell
            className={cn(itemClassName, "h-full w-full")}
            labelClassName="text-[10px] font-medium"
            variant="mobileNav"
            showLabel
            onBeforeOpen={() => {
              setOpenMobile(false);
              if (searchOpen) search?.closeSearch();
            }}
          />
        </div>
      </div>
    </nav>
  );
}
