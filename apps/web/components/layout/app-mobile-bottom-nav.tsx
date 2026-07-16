"use client";

import { Menu, Search, UserRound, X } from "lucide-react";
import { AppChromeNotificationBell } from "@/components/layout/app-chrome-notification-bell";
import { AppNavLink } from "@/components/navigation/app-nav-link";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import {
  normalizeNavHref,
  useSoftNavLock,
} from "@/components/providers/soft-nav-lock-provider";
import {
  isRestaurantDashboardPath,
  useDashboardGlobalSearchOptional,
} from "@/lib/contexts/dashboard-global-search-context";
import { APP_ROUTES } from "@/lib/navigation/app-routes";
import { appChromeFixedZoneBgClassName } from "@/lib/ui/app-chrome-fixed-zone";
import { APP_MOBILE_BOTTOM_NAV_BAR_H, appMobileBottomSafePbClassName } from "@/lib/ui/app-mobile-bottom-nav";
import { APP_LAYER_Z_INDEX } from "@/lib/ui/app-layer-z-index";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";

const itemClassName =
  "flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-none text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground";

const itemActiveClassName = "text-foreground";

/**
 * Mobile Primary-Nav: Menü · Suche · Meldungen · Profil (Thumb-Zone).
 * z über `mobileChromeOverlay` — Sheet fährt darunter durch; X bleibt klickbar.
 * FABs liegen geometrisch über der Nav (bottom-offset), nicht in derselben Fläche.
 * Desktop: nicht gerendert (`md:hidden`).
 */
export function AppMobileBottomNav() {
  const pathname = usePathname();
  const { pendingHref } = useSoftNavLock();
  const { openMobile, setOpenMobile, toggleSidebar } = useSidebar();
  const search = useDashboardGlobalSearchOptional();
  const showSearch = isRestaurantDashboardPath(pathname) && Boolean(search);
  const searchOpen = Boolean(search?.open);
  const profileHref = APP_ROUTES.profile.personal;
  const profilePending =
    pendingHref != null &&
    normalizeNavHref(pendingHref).startsWith(APP_ROUTES.profile.root);
  const profileActive =
    pathname.startsWith(APP_ROUTES.profile.root) || profilePending;

  return (
    <nav
      data-app-mobile-bottom-nav
      aria-label="Hauptnavigation"
      className={cn(
        "fixed inset-x-0 bottom-0 border-t border-border/50 md:hidden",
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
            toggleSidebar();
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

        <Button
          type="button"
          variant="ghost"
          className={cn(itemClassName, profileActive && itemActiveClassName)}
          aria-label="Profil"
          aria-current={profileActive ? "page" : undefined}
          render={<AppNavLink href={profileHref} prefetch />}
        >
          <UserRound className="size-5 shrink-0" aria-hidden />
          <span>Profil</span>
        </Button>
      </div>
    </nav>
  );
}
