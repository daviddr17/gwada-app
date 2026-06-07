"use client";

import {
  AnimatePresence,
  m,
  useDragControls,
} from "framer-motion";
import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from "react";
import {
  profileAvatarFallbackPlateClassName,
  restaurantLogoImageClassName,
  restaurantLogoPlateClassName,
} from "@/lib/ui/profile-avatar-image";
import { cn } from "@/lib/utils";
import type { ProfileAppDefinition, ProfileAppId } from "@/lib/public-profile/profile-app-config";
import {
  PROFILE_MODULE_LABEL_TRANSITION,
  profileModuleLabelVariants,
} from "@/lib/public-profile/profile-app-motion";
import {
  PROFILE_SHEET_HANDLE_FALLBACK_PX,
  PROFILE_SHEET_HANDLE_HEIGHT_VAR,
  PROFILE_SHEET_HEADER_HEIGHT_VAR,
  profileSheetTitleStickyTopStyle,
} from "@/lib/public-profile/profile-sheet-styles";
import type { PublicRestaurantProfile } from "@/lib/restaurant/public-restaurant-server";

/** Scroll-Distanz, bis das Logo vollständig kompakt ist (scrollt danach im normalen Flow weg). */
const LOGO_COLLAPSE_SCROLL_PX = 112;
const LOGO_SIZE_EXPANDED_PX = 80;
const LOGO_SIZE_COLLAPSED_PX = 44;

const profileSheetStickyChromeClassName =
  "bg-background/95 backdrop-blur-md supports-backdrop-filter:bg-background/80";

function restaurantInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (
      parts[0]!.slice(0, 1).toLocaleUpperCase("de-DE") +
      parts[1]!.slice(0, 1).toLocaleUpperCase("de-DE")
    );
  }
  return name.trim().slice(0, 2).toLocaleUpperCase("de-DE") || "?";
}

function logoCollapseProgress(scrollTop: number) {
  return Math.min(1, Math.max(0, scrollTop / LOGO_COLLAPSE_SCROLL_PX));
}

function lerp(from: number, to: number, progress: number) {
  return from + (to - from) * progress;
}

function syncProfileSheetPinnedHeaderHeight(
  root: HTMLElement,
  handle: HTMLElement,
  chrome: HTMLElement,
) {
  const handleHeight = Math.ceil(handle.offsetHeight);
  root.style.setProperty(
    PROFILE_SHEET_HANDLE_HEIGHT_VAR,
    `${handleHeight}px`,
  );

  const rootRect = root.getBoundingClientRect();
  let pinnedBottom = rootRect.top;
  for (const el of [handle, chrome]) {
    pinnedBottom = Math.max(pinnedBottom, el.getBoundingClientRect().bottom);
  }
  root.style.setProperty(
    PROFILE_SHEET_HEADER_HEIGHT_VAR,
    `${Math.max(0, pinnedBottom - rootRect.top)}px`,
  );

  return handleHeight;
}

function schedulePinnedHeaderResync(sync: () => void) {
  requestAnimationFrame(() => {
    sync();
    requestAnimationFrame(sync);
  });
}

export function ProfileAppSheetHeader({
  profile,
  activeApp,
  apps,
  reduceMotion,
  dragControls,
  dragEnabled,
  isDismissing,
  scrollRootRef,
  layoutEpoch,
  layoutReady,
}: {
  profile: PublicRestaurantProfile;
  activeApp: ProfileAppId;
  apps: ProfileAppDefinition[];
  reduceMotion: boolean | null;
  dragControls: ReturnType<typeof useDragControls>;
  dragEnabled: boolean;
  isDismissing: boolean;
  scrollRootRef: RefObject<HTMLElement | null>;
  /** Erhöht sich nach Open-/Reopen-Animation — erzwingt erneute Handle-Messung. */
  layoutEpoch: number;
  /** Sheet-Open-Animation abgeschlossen (Touch: etwas verzögert). */
  layoutReady: boolean;
}) {
  const headerApp = apps.find((app) => app.id === activeApp) ?? apps[0]!;
  const initials = restaurantInitials(profile.name);
  const handleRef = useRef<HTMLDivElement>(null);
  const stickyChromeRef = useRef<HTMLElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const startSheetDrag = useCallback(
    (event: React.PointerEvent) => {
      if (reduceMotion || isDismissing || !dragEnabled) return;
      dragControls.start(event);
    },
    [dragControls, dragEnabled, isDismissing, reduceMotion],
  );

  useLayoutEffect(() => {
    const root = scrollRootRef.current;
    const handle = handleRef.current;
    const chrome = stickyChromeRef.current;
    if (!root || !handle || !chrome) return;

    root.style.setProperty(
      PROFILE_SHEET_HANDLE_HEIGHT_VAR,
      `${PROFILE_SHEET_HANDLE_FALLBACK_PX}px`,
    );

    const sync = () => {
      if (isDismissing) return;
      syncProfileSheetPinnedHeaderHeight(root, handle, chrome);
    };

    const onScroll = () => {
      setScrollTop(root.scrollTop);
      sync();
    };

    sync();
    if (layoutReady) {
      schedulePinnedHeaderResync(sync);
    }

    root.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(sync);
    ro.observe(handle);
    ro.observe(chrome);
    return () => {
      root.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, [scrollRootRef, activeApp, layoutEpoch, layoutReady, isDismissing]);

  const logoProgress = reduceMotion ? 0 : logoCollapseProgress(scrollTop);
  const logoSize = lerp(LOGO_SIZE_EXPANDED_PX, LOGO_SIZE_COLLAPSED_PX, logoProgress);
  const logoPadding = lerp(8, 5, logoProgress);
  const logoGap = lerp(10, 6, logoProgress);

  return (
    <>
      <div
        ref={handleRef}
        data-profile-app-sheet-handle
        className={cn(
          "sticky top-0 z-20 shrink-0 cursor-grab active:cursor-grabbing",
          profileSheetStickyChromeClassName,
        )}
        onPointerDown={startSheetDrag}
      >
        <div className="flex justify-center px-4 pb-2 pt-3">
          <div
            className="h-1 w-10 shrink-0 rounded-full bg-muted-foreground/45"
            aria-hidden
          />
        </div>
      </div>

      <div
        className={cn(
          "flex shrink-0 flex-col items-center px-4",
          profileSheetStickyChromeClassName,
        )}
      >
        <span
          className={cn(
            "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/35 bg-card leading-none",
            profile.avatarUrl
              ? restaurantLogoPlateClassName
              : profileAvatarFallbackPlateClassName,
            !profile.avatarUrl && "text-sm font-semibold text-muted-foreground",
          )}
          style={{
            width: logoSize,
            height: logoSize,
            marginBottom: logoGap,
            fontSize: lerp(18, 14, logoProgress),
          }}
          aria-hidden
        >
          {profile.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatarUrl}
              alt=""
              decoding="async"
              className={cn(restaurantLogoImageClassName, "size-full")}
              style={{ padding: logoPadding }}
            />
          ) : (
            initials
          )}
        </span>
      </div>

      <header
        ref={stickyChromeRef}
        data-profile-app-sheet-header
        data-profile-sheet-no-pull
        className={cn(
          "sticky z-10 shrink-0 border-b border-border/40 py-2",
          profileSheetStickyChromeClassName,
        )}
        style={profileSheetTitleStickyTopStyle()}
      >
        <div className="flex flex-col items-center px-4">
          <p className="max-w-full truncate text-sm font-semibold tracking-tight text-foreground">
            {profile.name}
          </p>
          <div className="relative mt-0.5 h-5 w-full overflow-hidden">
            <AnimatePresence initial={false} mode="wait">
              <m.p
                key={headerApp.id}
                variants={reduceMotion ? undefined : profileModuleLabelVariants}
                initial={reduceMotion ? false : "enter"}
                animate={reduceMotion ? undefined : "center"}
                exit={reduceMotion ? undefined : "exit"}
                transition={PROFILE_MODULE_LABEL_TRANSITION}
                className="absolute inset-x-0 top-0 truncate text-center text-xs text-muted-foreground"
              >
                {headerApp.label}
              </m.p>
            </AnimatePresence>
          </div>
        </div>
      </header>
    </>
  );
}
