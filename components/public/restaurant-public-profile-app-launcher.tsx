"use client";

import {
  AnimatePresence,
  LazyMotion,
  animate,
  domMax,
  m,
  useDragControls,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type AnimationPlaybackControls,
  type PanInfo,
} from "framer-motion";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { RestaurantProfileBrandedCanvas, brandedProfileBackdropStyle } from "@/components/public/restaurant-profile-branded-canvas";
import type { PublicProfileLogoIntro } from "@/components/public/public-profile-logo-crossfade";
import { PublicProfileInfoSections } from "@/components/public/public-profile-info-sections";
import type { PublicProfileInfoTab } from "@/components/public/public-profile-info-sections";
import { useProfilePublicDockBridge } from "@/components/public/profile-public-dock-bridge";
import { RestaurantPublicProfileHeroCard } from "@/components/public/restaurant-public-profile-hero-card";
import { RestaurantPublicProfileModuleSkeleton } from "@/components/public/restaurant-public-profile-module-skeleton";
import { RestaurantPublicProfileReviews } from "@/components/public/restaurant-public-profile-reviews";
import { EmbedReservationTermsSheet } from "@/components/embed/embed-reservation-terms-sheet";
import type { EmbedReservationProfileTermsSheet } from "@/components/embed/embed-reservation-widget";
import { ProfileAppSheetHeader } from "@/components/public/profile-app-sheet-header";
import type { PublicEmbedMenu } from "@/lib/menu/public-menu-server";
import {
  profileAppsForModules,
  type ProfileAppDefinition,
  type ProfileAppId,
} from "@/lib/public-profile/profile-app-config";
import { useCoarsePointer } from "@/lib/hooks/use-coarse-pointer";
import {
  profileAppSwitchDirection,
  IOS_APP_CLOSE_TRANSITION,
  IOS_APP_DRAG_SNAP_BACK_TRANSITION,
  IOS_APP_OPEN_TRANSITION,
  IOS_APP_PAGER_SWITCH_TRANSITION,
  iosAppHorizontalPushVariants,
  PROFILE_MODULE_FADE_TRANSITION,
  profileModuleFadeVariants,
} from "@/lib/public-profile/profile-app-motion";
import {
  DRAG_REVEAL_ICON_PROGRESS,
  DRAG_TO_ICON_RANGE_PX,
  shouldDismissSheetPull,
  SWIPE_CLOSE_OFFSET_PX,
  SWIPE_CLOSE_VELOCITY,
} from "@/lib/public-profile/profile-sheet-gesture-constants";
import { useProfileSheetContentGestures } from "@/lib/public-profile/use-profile-sheet-content-gestures";
import { profileAppSheetClassName } from "@/lib/public-profile/profile-sheet-styles";
import {
  preloadProfileWidgetChunks,
  scheduleProfileBackgroundWork,
} from "@/lib/public-profile/preload-profile-chunks";
import {
  profileTabContentVariants,
} from "@/lib/public-profile/profile-tab-transition";
import {
  useProfileModuleCache,
  type ProfileModuleKey,
} from "@/lib/public-profile/use-profile-module-cache";
import { publicCountries } from "@/lib/reservations/public-embed-shared";
import type { PublicEmbedRestaurant } from "@/lib/reservations/public-embed-shared";
import type { PublicEmbedReviews } from "@/lib/reviews/public-reviews-server";
import type { PublicRestaurantProfile } from "@/lib/restaurant/public-restaurant-server";
import {
  formatPublicRestaurantAddress,
  publicRestaurantMapsUrl,
} from "@/lib/restaurant/public-maps-url";
import { cn } from "@/lib/utils";

const EmbedReservationWidget = dynamic(
  () =>
    import("@/components/embed/embed-reservation-widget").then(
      (mod) => mod.EmbedReservationWidget,
    ),
  { loading: () => <RestaurantPublicProfileModuleSkeleton /> },
);

const EmbedMenuWidget = dynamic(
  () =>
    import("@/components/embed/embed-menu-widget").then((mod) => mod.EmbedMenuWidget),
  { loading: () => <RestaurantPublicProfileModuleSkeleton /> },
);

const IOS_SHEET_OPEN_RADIUS_PX = 44;
/** Max. Backdrop-Blur beim geöffneten Sheet — Desktop only (iOS: zu teuer). */
const IOS_SHEET_BACKDROP_BLUR_PX = 12;
const IOS_SHEET_SLIDE_OPEN_ORIGIN = "50% 100%";

type SheetRestLayout = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type IconMorphTargets = {
  targetX: number;
  targetY: number;
  targetScale: number;
  targetRadius: number;
};

function captureSheetRestLayout(sheetEl: HTMLElement): SheetRestLayout {
  const rect = sheetEl.getBoundingClientRect();
  return {
    left: rect.left,
    top: rect.top,
    width: sheetEl.offsetWidth,
    height: sheetEl.offsetHeight,
  };
}

function computeIconMorphTargets(
  restLayout: SheetRestLayout,
  iconRect: DOMRect,
): IconMorphTargets {
  const sheetCx = restLayout.left + restLayout.width / 2;
  const sheetCy = restLayout.top + restLayout.height / 2;
  const iconCx = iconRect.left + iconRect.width / 2;
  const iconCy = iconRect.top + iconRect.height / 2;

  return {
    targetX: iconCx - sheetCx,
    targetY: iconCy - sheetCy,
    targetScale: iconRect.width / restLayout.width,
    targetRadius: iconRect.width * 0.22,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function sheetTransformOriginFromLayout(
  restLayout: SheetRestLayout,
  iconRect: DOMRect,
): string {
  const iconCx = iconRect.left + iconRect.width / 2;
  const iconCy = iconRect.top + iconRect.height / 2;
  const originX = clamp(
    ((iconCx - restLayout.left) / restLayout.width) * 100,
    6,
    94,
  );
  const originY = clamp(
    ((iconCy - restLayout.top) / restLayout.height) * 100,
    6,
    94,
  );
  return `${originX}% ${originY}%`;
}

function applyDragTowardsIcon(
  offsetY: number,
  restLayout: SheetRestLayout | null,
  iconRect: DOMRect | null,
  values: {
    x: ReturnType<typeof useMotionValue<number>>;
    y: ReturnType<typeof useMotionValue<number>>;
    scale: ReturnType<typeof useMotionValue<number>>;
    radius: ReturnType<typeof useMotionValue<number>>;
    contentOpacity: ReturnType<typeof useMotionValue<number>>;
    backdropOpacity: ReturnType<typeof useMotionValue<number>>;
  },
): number {
  const progress = Math.min(Math.max(offsetY, 0) / DRAG_TO_ICON_RANGE_PX, 1);

  if (!iconRect || !restLayout) {
    values.x.set(0);
    values.y.set(offsetY);
    values.scale.set(1 - progress * 0.22);
    values.radius.set(IOS_SHEET_OPEN_RADIUS_PX - progress * 26);
    values.contentOpacity.set(1 - progress * 0.85);
    values.backdropOpacity.set(1 - progress * 0.7);
    return progress;
  }

  const { targetX, targetY, targetScale, targetRadius } = computeIconMorphTargets(
    restLayout,
    iconRect,
  );

  values.x.set(targetX * progress);
  values.y.set(offsetY * (1 - progress * 0.85) + targetY * progress);
  values.scale.set(1 - progress * (1 - targetScale));
  values.radius.set(
    IOS_SHEET_OPEN_RADIUS_PX -
      progress * (IOS_SHEET_OPEN_RADIUS_PX - targetRadius),
  );
  values.contentOpacity.set(1 - progress * 0.92);
  values.backdropOpacity.set(1 - progress * 0.78);

  return progress;
}

function getLauncherIconRect(appId: ProfileAppId): DOMRect | null {
  if (typeof document === "undefined") return null;
  const el = document.querySelector(`[data-profile-launcher-icon="${appId}"]`);
  return el instanceof HTMLElement ? el.getBoundingClientRect() : null;
}

function resolveIconRect(
  activeApp: ProfileAppId,
  fallback: DOMRect | null,
): DOMRect | null {
  return getLauncherIconRect(activeApp) ?? fallback;
}

function getSheetSlideOffsetPx(sheetEl: HTMLElement | null): number {
  if (sheetEl?.offsetHeight) return sheetEl.offsetHeight;
  if (typeof window !== "undefined") {
    return Math.round(window.innerHeight * 0.55);
  }
  return 480;
}

function ModulePanel({
  showLoading,
  error,
  children,
}: {
  showLoading: boolean;
  error: string | null;
  children: React.ReactNode;
}) {
  if (showLoading) return <RestaurantPublicProfileModuleSkeleton />;
  if (error) {
    return (
      <div className="rounded-2xl border border-border/50 bg-card p-8 text-center text-sm text-muted-foreground shadow-card">
        Dieses Modul konnte gerade nicht geladen werden.
      </div>
    );
  }
  return <>{children}</>;
}

function ProfileAppSheetOverlay({
  activeApp,
  launchRect,
  apps,
  accentHex,
  reduceMotion,
  lightEffects,
  profile,
  reservation,
  menu,
  reviews,
  loading,
  errors,
  addressLine,
  mapsUrl,
  infoTab,
  onInfoTabChange,
  reopenRequest,
  onClosingChange,
  onDismissComplete,
}: {
  activeApp: ProfileAppId;
  launchRect: DOMRect | null;
  apps: ProfileAppDefinition[];
  accentHex: string;
  reduceMotion: boolean | null;
  /** Touch/iOS — kein animiertes Backdrop-Blur, leichtere Open-Animation. */
  lightEffects: boolean;
  profile: PublicRestaurantProfile;
  reservation: PublicEmbedRestaurant | null;
  menu: PublicEmbedMenu | null;
  reviews: PublicEmbedReviews | null;
  loading: Record<ProfileModuleKey, boolean>;
  errors: Record<ProfileModuleKey, string | null>;
  addressLine: string;
  mapsUrl: string | null;
  infoTab: PublicProfileInfoTab;
  onInfoTabChange: (tab: PublicProfileInfoTab) => void;
  /** Erhöht sich, wenn während des Schließens erneut geöffnet wird. */
  reopenRequest: number;
  onClosingChange: (closing: boolean) => void;
  onDismissComplete: () => void;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();
  const [dragEnabled, setDragEnabled] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);
  const [restLayout, setRestLayout] = useState<SheetRestLayout | null>(null);
  const [openSettled, setOpenSettled] = useState(!lightEffects);
  const dismissGenerationRef = useRef(0);
  const dismissControlsRef = useRef<AnimationPlaybackControls[]>([]);
  const [morphToIcon, setMorphToIcon] = useState(false);
  const [reservationTermsOpen, setReservationTermsOpen] = useState(false);

  useEffect(() => {
    if (activeApp !== "reserve") {
      setReservationTermsOpen(false);
    }
  }, [activeApp]);

  const reservationTermsSheet = useMemo<EmbedReservationProfileTermsSheet>(
    () => ({
      open: reservationTermsOpen,
      onOpenChange: setReservationTermsOpen,
    }),
    [reservationTermsOpen],
  );

  const morphOrigin = useMemo(() => {
    const iconRect = resolveIconRect(activeApp, launchRect);
    if (!iconRect || !restLayout) return "50% 50%";
    return sheetTransformOriginFromLayout(restLayout, iconRect);
  }, [activeApp, launchRect, restLayout]);

  const x = useMotionValue(0);
  const y = useMotionValue(getSheetSlideOffsetPx(null));
  const scale = useMotionValue(1);
  const radius = useMotionValue(IOS_SHEET_OPEN_RADIUS_PX);
  const sheetOpacity = useMotionValue(1);
  const contentOpacity = useMotionValue(1);
  const backdropOpacity = useMotionValue(0);
  const backdropBlur = useTransform(
    backdropOpacity,
    (value) =>
      lightEffects
        ? "none"
        : `blur(${Math.max(0, value * IOS_SHEET_BACKDROP_BLUR_PX)}px)`,
  );
  const borderRadius = useTransform(radius, (value) => `${value}px`);
  const dragRevealStarted = useRef(false);
  const brandedBackdrop = useMemo(
    () => brandedProfileBackdropStyle(accentHex),
    [accentHex],
  );

  const appIds = useMemo(() => apps.map((app) => app.id), [apps]);
  const prevActiveAppRef = useRef(activeApp);
  const switchDirection = profileAppSwitchDirection(
    appIds,
    prevActiveAppRef.current,
    activeApp,
  );

  useLayoutEffect(() => {
    prevActiveAppRef.current = activeApp;
  }, [activeApp]);

  const viewportRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    viewportRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [activeApp]);
  const getScrollTop = useCallback(
    () => viewportRef.current?.scrollTop ?? 0,
    [],
  );

  const dragMotionValues = useMemo(
    () => ({
      x,
      y,
      scale,
      radius,
      contentOpacity,
      backdropOpacity,
    }),
    [x, y, scale, radius, contentOpacity, backdropOpacity],
  );

  const snapOpen = useCallback(() => {
    dragRevealStarted.current = false;
    setMorphToIcon(false);
    void Promise.all([
      animate(x, 0, IOS_APP_DRAG_SNAP_BACK_TRANSITION),
      animate(y, 0, IOS_APP_DRAG_SNAP_BACK_TRANSITION),
      animate(scale, 1, IOS_APP_DRAG_SNAP_BACK_TRANSITION),
      animate(radius, IOS_SHEET_OPEN_RADIUS_PX, IOS_APP_DRAG_SNAP_BACK_TRANSITION),
      animate(contentOpacity, 1, IOS_APP_DRAG_SNAP_BACK_TRANSITION),
      animate(backdropOpacity, 1, IOS_APP_DRAG_SNAP_BACK_TRANSITION),
    ]);
  }, [x, y, scale, radius, contentOpacity, backdropOpacity]);

  const stopDismissAnimations = useCallback(() => {
    for (const control of dismissControlsRef.current) {
      control.stop();
    }
    dismissControlsRef.current = [];
  }, []);

  const playSlideOpen = useCallback(() => {
    setMorphToIcon(false);
    dragRevealStarted.current = false;
    x.set(0);
    scale.set(1);
    radius.set(IOS_SHEET_OPEN_RADIUS_PX);
    contentOpacity.set(1);
    sheetOpacity.set(1);
    backdropOpacity.set(0);

    const offset = getSheetSlideOffsetPx(sheetRef.current);
    y.set(offset);

    if (sheetRef.current) {
      setRestLayout(captureSheetRestLayout(sheetRef.current));
    }
    setDragEnabled(true);

    void Promise.all([
      animate(y, 0, IOS_APP_OPEN_TRANSITION),
      animate(backdropOpacity, 1, { duration: 0.28, ease: "easeOut" }),
    ]).then(() => {
      setOpenSettled(true);
      if (sheetRef.current) {
        setRestLayout(captureSheetRestLayout(sheetRef.current));
      }
    });
  }, [
    x,
    y,
    scale,
    radius,
    contentOpacity,
    sheetOpacity,
    backdropOpacity,
  ]);

  const cancelDismissAndOpen = useCallback(() => {
    if (!isDismissing) return;
    dismissGenerationRef.current += 1;
    stopDismissAnimations();
    setIsDismissing(false);
    onClosingChange(false);
    setDragEnabled(true);
    setOpenSettled(true);
    setMorphToIcon(false);
    dragRevealStarted.current = false;
    void Promise.all([
      animate(x, 0, IOS_APP_DRAG_SNAP_BACK_TRANSITION),
      animate(y, 0, IOS_APP_DRAG_SNAP_BACK_TRANSITION),
      animate(scale, 1, IOS_APP_DRAG_SNAP_BACK_TRANSITION),
      animate(radius, IOS_SHEET_OPEN_RADIUS_PX, IOS_APP_DRAG_SNAP_BACK_TRANSITION),
      animate(contentOpacity, 1, IOS_APP_DRAG_SNAP_BACK_TRANSITION),
      animate(backdropOpacity, 1, IOS_APP_DRAG_SNAP_BACK_TRANSITION),
      animate(sheetOpacity, 1, { duration: 0.12, ease: "easeOut" }),
    ]);
  }, [
    isDismissing,
    onClosingChange,
    stopDismissAnimations,
    x,
    y,
    scale,
    radius,
    contentOpacity,
    backdropOpacity,
    sheetOpacity,
  ]);

  const dismissToIcon = useCallback(async (options?: { fromDrag?: boolean }) => {
    if (isDismissing) return;
    const generation = dismissGenerationRef.current + 1;
    dismissGenerationRef.current = generation;
    setIsDismissing(true);
    onClosingChange(true);
    setDragEnabled(false);
    if (reduceMotion || !sheetRef.current) {
      onClosingChange(false);
      onDismissComplete();
      return;
    }

    const iconRect = resolveIconRect(activeApp, launchRect);
    const layout =
      restLayout ?? captureSheetRestLayout(sheetRef.current);

    const slideDownClose = async () => {
      setMorphToIcon(false);
      const controls = [
        animate(y, getSheetSlideOffsetPx(sheetRef.current), {
          duration: 0.26,
          ease: "easeIn",
        }),
        animate(backdropOpacity, 0, { duration: 0.22, ease: "easeOut" }),
        animate(contentOpacity, 0, { duration: 0.14, ease: "easeOut" }),
      ];
      dismissControlsRef.current = controls;
      await Promise.all(controls);
      if (dismissGenerationRef.current !== generation) return;
      dismissControlsRef.current = [];
      const fadeOut = animate(sheetOpacity, 0, { duration: 0.08, ease: "easeOut" });
      dismissControlsRef.current = [fadeOut];
      await fadeOut;
      if (dismissGenerationRef.current !== generation) return;
      dismissControlsRef.current = [];
      setMorphToIcon(false);
      onClosingChange(false);
      onDismissComplete();
    };

    const useIconMorph =
      options?.fromDrag &&
      dragRevealStarted.current &&
      iconRect != null;

    if (!useIconMorph) {
      await slideDownClose();
      return;
    }

    setMorphToIcon(true);

    const { targetX, targetY, targetScale, targetRadius } = computeIconMorphTargets(
      layout,
      iconRect!,
    );

    const controls = [
      animate(x, targetX, IOS_APP_CLOSE_TRANSITION),
      animate(y, targetY, IOS_APP_CLOSE_TRANSITION),
      animate(scale, targetScale, IOS_APP_CLOSE_TRANSITION),
      animate(radius, targetRadius, IOS_APP_CLOSE_TRANSITION),
      animate(contentOpacity, 0, { duration: 0.12, ease: "easeOut" }),
      animate(backdropOpacity, 0, { duration: 0.28, ease: "easeOut" }),
    ];
    dismissControlsRef.current = controls;

    await Promise.all(controls);
    if (dismissGenerationRef.current !== generation) return;

    dismissControlsRef.current = [];
    const fadeOut = animate(sheetOpacity, 0, { duration: 0.08, ease: "easeOut" });
    dismissControlsRef.current = [fadeOut];
    await fadeOut;
    if (dismissGenerationRef.current !== generation) return;

    dismissControlsRef.current = [];
    setMorphToIcon(false);
    onClosingChange(false);
    onDismissComplete();
  }, [
    activeApp,
    isDismissing,
    launchRect,
    onClosingChange,
    onDismissComplete,
    reduceMotion,
    restLayout,
    x,
    y,
    scale,
    radius,
    contentOpacity,
    sheetOpacity,
    backdropOpacity,
  ]);

  const cancelDismissAndOpenRef = useRef(cancelDismissAndOpen);
  cancelDismissAndOpenRef.current = cancelDismissAndOpen;

  useEffect(() => {
    if (reopenRequest > 0) {
      cancelDismissAndOpenRef.current();
    }
  }, [reopenRequest]);

  useLayoutEffect(() => {
    setIsDismissing(false);
    setMorphToIcon(false);
    setDragEnabled(false);
    setRestLayout(null);
    setOpenSettled(!lightEffects);
    dragRevealStarted.current = false;
    stopDismissAnimations();
    x.set(0);
    radius.set(IOS_SHEET_OPEN_RADIUS_PX);
    contentOpacity.set(1);

    if (reduceMotion) {
      scale.set(1);
      y.set(0);
      sheetOpacity.set(1);
      backdropOpacity.set(1);
      if (sheetRef.current) {
        setRestLayout(captureSheetRestLayout(sheetRef.current));
      }
      setDragEnabled(true);
      setOpenSettled(true);
      return;
    }

    playSlideOpen();
    // Mount-only: do not re-run when switching modules inside the open sheet
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [reduceMotion]);

  const handleDrag = (_event: PointerEvent, info: PanInfo) => {
    if (isDismissing) return;

    const offsetY = Math.max(0, info.offset.y);
    const iconRect = resolveIconRect(activeApp, launchRect);
    const progress = applyDragTowardsIcon(
      offsetY,
      restLayout,
      iconRect,
      dragMotionValues,
    );

    if (progress >= DRAG_REVEAL_ICON_PROGRESS && !dragRevealStarted.current) {
      dragRevealStarted.current = true;
    }
  };

  const handleDragEnd = (_event: PointerEvent, info: PanInfo) => {
    if (isDismissing) return;

    if (
      shouldDismissSheetPull(
        Math.max(0, info.offset.y),
        info.velocity.y,
        false,
      )
    ) {
      void dismissToIcon({ fromDrag: true });
      return;
    }

    snapOpen();
  };

  const applyContentPullDrag = useCallback(
    (offsetY: number, values: typeof dragMotionValues) => {
      const iconRect = resolveIconRect(activeApp, launchRect);
      return applyDragTowardsIcon(offsetY, restLayout, iconRect, values);
    },
    [activeApp, launchRect, restLayout, dragMotionValues],
  );

  useProfileSheetContentGestures({
    scrollRef: viewportRef,
    scrollKey: activeApp,
    enabled: Boolean(dragEnabled && !isDismissing && !reduceMotion),
    getScrollTop,
    dragRevealProgress: DRAG_REVEAL_ICON_PROGRESS,
    dragRangePx: DRAG_TO_ICON_RANGE_PX,
    applyDrag: applyContentPullDrag,
    dragMotionValues,
    dragRevealStartedRef: dragRevealStarted,
    onDragRevealIcon: () => {},
    snapOpen,
    dismissToIcon: () => {
      void dismissToIcon({ fromDrag: true });
    },
  });

  return (
    <>
      {!lightEffects ? (
        <m.div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-[54]"
          style={{
            backdropFilter: backdropBlur,
            WebkitBackdropFilter: backdropBlur,
          }}
        />
      ) : null}
      <m.button
        type="button"
        aria-label="App schließen"
        className={cn(
          "fixed inset-0 z-[55]",
          lightEffects && "bg-black/40",
        )}
        style={
          lightEffects
            ? {
                opacity: backdropOpacity,
                pointerEvents: isDismissing ? "none" : "auto",
              }
            : {
                ...brandedBackdrop,
                opacity: backdropOpacity,
                pointerEvents: isDismissing ? "none" : "auto",
              }
        }
        onClick={() => {
          if (reservationTermsOpen) {
            setReservationTermsOpen(false);
            return;
          }
          void dismissToIcon();
        }}
      />
      <m.div
        ref={sheetRef}
        drag={dragEnabled && !isDismissing && !reduceMotion ? "y" : false}
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0 }}
        dragElastic={{ top: 0, bottom: 0.38 }}
        dragMomentum={false}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        className={profileAppSheetClassName(lightEffects)}
        style={{
          x,
          y,
          scale,
          opacity: sheetOpacity,
          borderRadius,
          transformOrigin: morphToIcon ? morphOrigin : IOS_SHEET_SLIDE_OPEN_ORIGIN,
        }}
      >
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <m.div
            className="relative h-full min-h-0"
            style={{ opacity: contentOpacity }}
          >
            <div
              ref={viewportRef}
              data-profile-app-scroll-root
              className="absolute inset-0 overflow-x-hidden overflow-y-auto overscroll-contain touch-pan-y"
            >
              <ProfileAppSheetHeader
                profile={profile}
                activeApp={activeApp}
                apps={apps}
                reduceMotion={reduceMotion}
                dragControls={dragControls}
                dragEnabled={dragEnabled}
                isDismissing={isDismissing}
                scrollRootRef={viewportRef}
              />
              <div className="grid min-h-0 *:col-start-1 *:row-start-1">
                <AnimatePresence initial={false} custom={switchDirection}>
                  <m.div
                    key={activeApp}
                    custom={switchDirection}
                    variants={
                      reduceMotion
                        ? undefined
                        : activeApp === "menu"
                          ? profileModuleFadeVariants
                          : iosAppHorizontalPushVariants
                    }
                    initial={reduceMotion ? false : "enter"}
                    animate={reduceMotion ? undefined : "center"}
                    exit={reduceMotion ? undefined : "exit"}
                    transition={
                      activeApp === "menu"
                        ? PROFILE_MODULE_FADE_TRANSITION
                        : IOS_APP_PAGER_SWITCH_TRANSITION
                    }
                    className="w-full min-w-0 bg-background"
                  >
                    <ProfileAppContent
                      appId={activeApp}
                      profile={profile}
                      reservation={reservation}
                      menu={menu}
                      reviews={reviews}
                      loading={loading}
                      errors={errors}
                      addressLine={addressLine}
                      mapsUrl={mapsUrl}
                      infoTab={infoTab}
                      onInfoTabChange={onInfoTabChange}
                      skipEnterAnimation
                      reduceMotion={reduceMotion}
                      deferHeavyWidgets={lightEffects && !openSettled}
                      reservationTermsSheet={reservationTermsSheet}
                    />
                  </m.div>
                </AnimatePresence>
              </div>
            </div>
          </m.div>
        </div>
      </m.div>
      {activeApp === "reserve" && reservation ? (
        <EmbedReservationTermsSheet
          open={reservationTermsOpen}
          onOpenChange={setReservationTermsOpen}
          restaurantName={reservation.name}
          elevated
        />
      ) : null}
    </>
  );
}

function ProfileAppContent({
  appId,
  profile,
  reservation,
  menu,
  reviews,
  loading,
  errors,
  addressLine,
  mapsUrl,
  infoTab,
  onInfoTabChange,
  skipEnterAnimation,
  reduceMotion,
  deferHeavyWidgets = false,
  reservationTermsSheet,
}: {
  appId: ProfileAppId;
  profile: PublicRestaurantProfile;
  reservation: PublicEmbedRestaurant | null;
  menu: PublicEmbedMenu | null;
  reviews: PublicEmbedReviews | null;
  loading: Record<ProfileModuleKey, boolean>;
  errors: Record<ProfileModuleKey, string | null>;
  addressLine: string;
  mapsUrl: string | null;
  infoTab: PublicProfileInfoTab;
  onInfoTabChange: (tab: PublicProfileInfoTab) => void;
  skipEnterAnimation?: boolean;
  reduceMotion: boolean | null;
  deferHeavyWidgets?: boolean;
  reservationTermsSheet: EmbedReservationProfileTermsSheet;
}) {
  if (appId === "info") {
    const infoClassName = "space-y-4 p-4 pb-8 sm:p-5";
    const sectionClassName =
      "rounded-2xl border border-border/50 bg-card/80 p-5 shadow-card backdrop-blur-sm";

    if (skipEnterAnimation || reduceMotion) {
      return (
        <PublicProfileInfoSections
          profile={profile}
          addressLine={addressLine}
          mapsUrl={mapsUrl}
          tab={infoTab}
          onTabChange={onInfoTabChange}
          className={infoClassName}
          sectionClassName={sectionClassName}
        />
      );
    }

    return (
      <m.div
        variants={profileTabContentVariants}
        initial="hidden"
        animate="visible"
        className={infoClassName}
      >
        <PublicProfileInfoSections
          profile={profile}
          addressLine={addressLine}
          mapsUrl={mapsUrl}
          tab={infoTab}
          onTabChange={onInfoTabChange}
          sectionClassName={sectionClassName}
        />
      </m.div>
    );
  }

  const cardClass =
    "overflow-hidden rounded-2xl border border-border/50 bg-card/95 shadow-card backdrop-blur-sm";

  if (appId === "reserve") {
    return (
      <div className="p-4 pb-8 sm:p-5">
        <ModulePanel
          showLoading={deferHeavyWidgets || (!reservation && loading.reservation)}
          error={errors.reservation}
        >
          {reservation ? (
            <div className={cardClass}>
              <EmbedReservationWidget
                config={reservation}
                countries={publicCountries()}
                variant="profileSheet"
                profileTermsSheet={reservationTermsSheet}
              />
            </div>
          ) : null}
        </ModulePanel>
      </div>
    );
  }

  if (appId === "menu") {
    return (
      <div className="px-4 pb-8 pt-0 sm:px-5 sm:pb-5">
        <ModulePanel
          showLoading={deferHeavyWidgets || (!menu && loading.menu)}
          error={errors.menu}
        >
          {menu ? (
            <div className="overflow-visible rounded-2xl border border-border/50 bg-card/95 shadow-card backdrop-blur-sm">
              <EmbedMenuWidget
                variant="profileSheet"
                restaurantName={menu.name}
                accentHex={menu.accentHex}
                categories={menu.categories}
                items={menu.items}
                tagDefinitions={menu.tagDefinitions}
              />
            </div>
          ) : null}
        </ModulePanel>
      </div>
    );
  }

  return (
    <div className="p-4 pb-8 sm:p-5">
      <ModulePanel
        showLoading={deferHeavyWidgets || (!reviews && loading.reviews)}
        error={errors.reviews}
      >
        {reviews ? (
          <div className={cardClass}>
            <RestaurantPublicProfileReviews
              reviews={reviews.reviews}
              connectedPlatforms={reviews.connectedPlatforms}
            />
          </div>
        ) : null}
      </ModulePanel>
    </div>
  );
}

export function RestaurantPublicProfileAppLauncher({
  profile,
  heroVisible = true,
  logoIntro,
}: {
  profile: PublicRestaurantProfile;
  heroVisible?: boolean;
  logoIntro?: PublicProfileLogoIntro;
}) {
  const reduceMotion = useReducedMotion();
  const lightEffects = useCoarsePointer();
  const { cache, state, loadModule, preloadModules } = useProfileModuleCache(
    profile.slug,
  );
  const backgroundStarted = useRef(false);
  const [portalReady, setPortalReady] = useState(
    () => typeof document !== "undefined",
  );

  const apps = useMemo(
    () => profileAppsForModules(profile.modules),
    [profile.modules],
  );

  const [activeApp, setActiveApp] = useState<ProfileAppId | null>(null);
  const [launchRect, setLaunchRect] = useState<DOMRect | null>(null);
  const [infoTab, setInfoTab] = useState<PublicProfileInfoTab>("contact");
  const [isSheetClosing, setIsSheetClosing] = useState(false);
  const [reopenRequest, setReopenRequest] = useState(0);

  const switchSheetModule = useCallback(
    (appId: ProfileAppId) => {
      if (appId === "info") {
        setInfoTab("contact");
      }
      setActiveApp(appId);
      const app = apps.find((a) => a.id === appId);
      if (app?.module) void loadModule(app.module);
    },
    [apps, loadModule],
  );

  const openApp = useCallback(
    (
      appId: ProfileAppId,
      rect: DOMRect,
      options?: { infoTab?: PublicProfileInfoTab },
    ) => {
      const app = apps.find((a) => a.id === appId);
      if (!app) return;

      if (appId === "info") {
        setInfoTab(options?.infoTab ?? "contact");
      }

      if (isSheetClosing) {
        setReopenRequest((n) => n + 1);
      }

      if (activeApp && !isSheetClosing) {
        const iconRect = getLauncherIconRect(appId);
        if (iconRect) setLaunchRect(iconRect);
      } else {
        setLaunchRect(rect);
      }

      setActiveApp(appId);
      if (app.module) void loadModule(app.module);
    },
    [activeApp, apps, isSheetClosing, loadModule],
  );

  const openInfoAtTab = useCallback(
    (tab: PublicProfileInfoTab, sourceRect?: DOMRect) => {
      const rect = sourceRect ?? getLauncherIconRect("info");
      if (!rect) return;
      openApp("info", rect, { infoTab: tab });
    },
    [openApp],
  );

  const handleDismissComplete = useCallback(() => {
    setIsSheetClosing(false);
    setReopenRequest(0);
    setActiveApp(null);
  }, []);

  const handleClosingChange = useCallback((closing: boolean) => {
    setIsSheetClosing(closing);
  }, []);

  const startBackgroundPreload = useCallback(() => {
    if (backgroundStarted.current) return;
    backgroundStarted.current = true;
    preloadProfileWidgetChunks();
    const modules = apps
      .map((a) => a.module)
      .filter((m): m is ProfileModuleKey => Boolean(m));
    void preloadModules(modules);
  }, [apps, preloadModules]);

  useEffect(() => {
    if (lightEffects) {
      startBackgroundPreload();
      return;
    }
    return scheduleProfileBackgroundWork(startBackgroundPreload);
  }, [lightEffects, startBackgroundPreload]);

  useLayoutEffect(() => {
    setPortalReady(true);
  }, []);

  const addressLine = formatPublicRestaurantAddress(profile);
  const mapsUrl = publicRestaurantMapsUrl(profile);

  const reservation = cache.reservation as PublicEmbedRestaurant | null;
  const menu = cache.menu as PublicEmbedMenu | null;
  const reviews = cache.reviews as PublicEmbedReviews | null;

  const isAppOpen = activeApp !== null;

  const loading = {
    reservation: state.reservation.loading,
    menu: state.menu.loading,
    reviews: state.reviews.loading,
  };
  const errors = {
    reservation: state.reservation.error,
    menu: state.menu.error,
    reviews: state.reviews.error,
  };

  const dockBridge = useProfilePublicDockBridge();

  useLayoutEffect(() => {
    if (!dockBridge) return;

    dockBridge.setDockState({
      apps,
      activeApp,
      isAppOpen,
      isSheetClosing,
      reduceMotion,
      onOpenApp: openApp,
      onSwitchModule: switchSheetModule,
      onPreloadModule: (module) => {
        void loadModule(module, { silent: true });
      },
    });

    return () => {
      dockBridge.setDockState(null);
    };
  }, [
    dockBridge,
    apps,
    activeApp,
    isAppOpen,
    isSheetClosing,
    reduceMotion,
    openApp,
    switchSheetModule,
    loadModule,
  ]);

  const sheetPortal =
    portalReady
      ? createPortal(
          <AnimatePresence
            onExitComplete={() => {
              setLaunchRect(null);
            }}
          >
            {isAppOpen && activeApp ? (
              <ProfileAppSheetOverlay
                key="profile-app-overlay"
                activeApp={activeApp}
                launchRect={launchRect}
                apps={apps}
                accentHex={profile.accentHex}
                reduceMotion={reduceMotion}
                lightEffects={lightEffects}
                profile={profile}
                reservation={reservation}
                menu={menu}
                reviews={reviews}
                loading={loading}
                errors={errors}
                addressLine={addressLine}
                mapsUrl={mapsUrl}
                infoTab={infoTab}
                onInfoTabChange={setInfoTab}
                reopenRequest={reopenRequest}
                onClosingChange={handleClosingChange}
                onDismissComplete={handleDismissComplete}
              />
            ) : null}
          </AnimatePresence>,
          document.body,
        )
      : null;

  return (
    <LazyMotion features={domMax}>
      {heroVisible ? (
        <div className="relative flex h-dvh flex-col overflow-hidden">
          <RestaurantProfileBrandedCanvas
            accentHex={profile.accentHex}
            sheetOpen={isAppOpen}
          />
          <div
            className={cn(
              "pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-32 bg-gradient-to-b from-transparent to-background transition-opacity duration-300 ease-out",
              isAppOpen && "opacity-0",
            )}
            aria-hidden
          />
          <RestaurantPublicProfileHeroCard
            profile={profile}
            logoIntro={logoIntro}
            onOpeningStatusPress={(rect) => openInfoAtTab("hours", rect)}
          />
        </div>
      ) : null}

      {sheetPortal}
    </LazyMotion>
  );
}
