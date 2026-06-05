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
  type PanInfo,
} from "framer-motion";
import { Mail, MapPin, Phone } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { FacebookGlyph } from "@/components/icons/facebook-glyph";
import { GoogleGlyph } from "@/components/icons/google-glyph";
import { InstagramGlyph } from "@/components/icons/instagram-glyph";
import { RestaurantPublicProfileModuleSkeleton } from "@/components/public/restaurant-public-profile-module-skeleton";
import { RestaurantPublicOpeningHours } from "@/components/public/restaurant-public-opening-hours";
import { RestaurantPublicProfileReviews } from "@/components/public/restaurant-public-profile-reviews";
import type { PublicEmbedMenu } from "@/lib/menu/public-menu-server";
import {
  profileAppsForModules,
  type ProfileAppDefinition,
  type ProfileAppId,
} from "@/lib/public-profile/profile-app-config";
import {
  IOS_APP_CLOSE_TRANSITION,
  IOS_APP_DRAG_SNAP_BACK_TRANSITION,
  IOS_APP_OPEN_TRANSITION,
  IOS_APP_SWITCH_TRANSITION,
  iosAppHorizontalPushVariants,
  iosLauncherIconVariants,
} from "@/lib/public-profile/profile-app-motion";
import {
  preloadProfileWidgetChunks,
  scheduleProfileBackgroundWork,
} from "@/lib/public-profile/preload-profile-chunks";
import {
  profileTabContentVariants,
  profileTabItemVariants,
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

/** iOS-Home-Screen-Icon: ~60pt Kachel, Squircle-Radius ~22 % */
const IOS_ICON_TILE_CLASS =
  "relative flex size-[3.75rem] shrink-0 items-center justify-center overflow-hidden rounded-[22%] bg-gradient-to-br shadow-[0_2px_6px_rgba(0,0,0,0.14),0_10px_28px_rgba(0,0,0,0.18)] ring-1 ring-black/[0.08] transition-transform active:scale-[0.92] dark:ring-white/15";

const PROFILE_APP_SHEET_CLASS = cn(
  "fixed z-[60] flex flex-col overflow-hidden",
  "top-[max(3.5rem,env(safe-area-inset-top))]",
  "bottom-[max(5.5rem,env(safe-area-inset-bottom))]",
  "left-0 right-0 mx-auto w-[calc(100%-1.5rem)] md:w-[60vw]",
  "border border-white/25 bg-background/95",
  "shadow-[0_24px_80px_-12px_rgba(0,0,0,0.45)] backdrop-blur-2xl dark:border-white/10",
);

const SWIPE_CLOSE_OFFSET_PX = 96;
const SWIPE_CLOSE_VELOCITY = 520;
const IOS_SHEET_OPEN_RADIUS_PX = 44;
const DRAG_TO_ICON_RANGE_PX = 380;
const DRAG_REVEAL_ICON_PROGRESS = 0.18;

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
    dockOpacity: ReturnType<typeof useMotionValue<number>>;
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
    values.dockOpacity.set(1 - progress * 0.88);
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
  values.dockOpacity.set(1 - progress * 0.94);

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

function ProfileContactLink({
  href,
  icon,
  label,
  external,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="flex items-start gap-2.5 rounded-xl border border-border/40 bg-background/60 px-3 py-2.5 text-sm transition-colors hover:border-accent/40 hover:bg-accent/5"
    >
      <span className="mt-0.5 shrink-0 text-accent">{icon}</span>
      <span className="min-w-0 break-words">{label}</span>
    </a>
  );
}

function ProfileInfoSections({
  profile,
  addressLine,
  mapsUrl,
  className,
  sectionClassName,
  hoursSectionVariants,
  contactSectionVariants,
  socialSectionVariants,
}: {
  profile: PublicRestaurantProfile;
  addressLine: string;
  mapsUrl: string | null;
  className?: string;
  sectionClassName: string;
  hoursSectionVariants?: typeof profileTabItemVariants;
  contactSectionVariants?: typeof profileTabItemVariants;
  socialSectionVariants?: typeof profileTabItemVariants;
}) {
  const phone = profile.phone?.trim();
  const email = profile.email?.trim();
  const socialLinks = profile.socialLinks.filter(
    (link) => link.kind !== "phone" && link.kind !== "email",
  );
  const hasContact = Boolean(phone || email || addressLine);
  const Section = hoursSectionVariants ? m.section : "section";

  return (
    <div className={cn("space-y-4", className)}>
      {hasContact ? (
        <Section
          variants={contactSectionVariants}
          className={sectionClassName}
        >
          <h2 className="text-sm font-semibold tracking-tight">Kontakt</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {phone ? (
              <ProfileContactLink
                href={`tel:${phone.replace(/\s+/g, "")}`}
                icon={<Phone className="size-4" aria-hidden />}
                label={phone}
              />
            ) : null}
            {addressLine && mapsUrl ? (
              <ProfileContactLink
                href={mapsUrl}
                icon={<MapPin className="size-4" aria-hidden />}
                label={addressLine}
                external
              />
            ) : addressLine ? (
              <div className="flex items-start gap-2.5 rounded-xl border border-border/40 bg-background/60 px-3 py-2.5 text-sm text-muted-foreground">
                <MapPin className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                <span className="min-w-0 break-words">{addressLine}</span>
              </div>
            ) : null}
            {email ? (
              <ProfileContactLink
                href={`mailto:${email}`}
                icon={<Mail className="size-4" aria-hidden />}
                label={email}
              />
            ) : null}
          </div>
        </Section>
      ) : null}

      <Section variants={hoursSectionVariants} className={sectionClassName}>
        <h2 className="text-sm font-semibold tracking-tight">Öffnungszeiten</h2>
        <RestaurantPublicOpeningHours
          weeklyHours={profile.weeklyHours}
          className="mt-3"
        />
      </Section>

      {socialLinks.length > 0 ? (
        <Section variants={socialSectionVariants} className={sectionClassName}>
          <h2 className="text-sm font-semibold tracking-tight">Social Media</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {socialLinks.map((link) => (
              <SocialLinkChip key={`info-${link.kind}-${link.href}`} link={link} />
            ))}
          </div>
        </Section>
      ) : null}
    </div>
  );
}

function SocialLinkChip({
  link,
}: {
  link: PublicRestaurantProfile["socialLinks"][number];
}) {
  const icon =
    link.kind === "facebook" ? (
      <FacebookGlyph className="size-4" />
    ) : link.kind === "instagram" ? (
      <InstagramGlyph className="size-4" />
    ) : link.kind === "google" ? (
      <GoogleGlyph className="size-4" />
    ) : link.kind === "phone" ? (
      <Phone className="size-4" aria-hidden />
    ) : (
      <Mail className="size-4" aria-hidden />
    );

  return (
    <a
      href={link.href}
      target={link.kind === "phone" || link.kind === "email" ? undefined : "_blank"}
      rel={
        link.kind === "phone" || link.kind === "email"
          ? undefined
          : "noopener noreferrer"
      }
      className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border/60 bg-background/80 px-4 py-2 text-sm font-medium shadow-sm backdrop-blur-md transition-colors hover:border-accent/40 hover:bg-accent/5"
    >
      {icon}
      <span className="max-w-[10rem] truncate">{link.label}</span>
    </a>
  );
}

function ProfileAppIconTile({
  app,
  index,
  accentHex,
  isHidden,
  onOpen,
  reduceMotion,
}: {
  app: ProfileAppDefinition;
  index: number;
  accentHex: string;
  isHidden: boolean;
  onOpen: (rect: DOMRect) => void;
  reduceMotion: boolean | null;
}) {
  const Icon = app.icon;

  return (
    <m.li
      variants={reduceMotion ? undefined : iosLauncherIconVariants}
      custom={index}
      className="flex flex-col items-center gap-1.5"
    >
      <button
        type="button"
        data-profile-launcher-icon={app.id}
        onClick={(event) => onOpen(event.currentTarget.getBoundingClientRect())}
        className={cn(
          IOS_ICON_TILE_CLASS,
          app.gradient,
          isHidden && "pointer-events-none opacity-0",
        )}
        style={{
          boxShadow: `0 2px 6px rgba(0,0,0,0.14), 0 10px 28px -6px color-mix(in srgb, ${accentHex} 40%, transparent)`,
        }}
        aria-label={app.label}
        aria-hidden={isHidden}
        tabIndex={isHidden ? -1 : 0}
      >
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/30 to-transparent opacity-60 dark:from-white/20"
          aria-hidden
        />
        <Icon
          className="relative size-[1.65rem] text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]"
          strokeWidth={2.1}
        />
      </button>
      <span
        className={cn(
          "max-w-[4.5rem] truncate text-center text-[11px] font-medium leading-tight tracking-tight text-foreground/90",
          isHidden && "opacity-0",
        )}
      >
        {app.label}
      </span>
    </m.li>
  );
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
  definition,
  apps,
  switchDirection,
  reduceMotion,
  onDismissStart,
  onDragRevealIcon,
  onDragSnapBack,
  onDismissComplete,
  onOpenApp,
  onPreloadModule,
  children,
}: {
  activeApp: ProfileAppId;
  launchRect: DOMRect | null;
  definition: ProfileAppDefinition;
  apps: ProfileAppDefinition[];
  switchDirection: number;
  reduceMotion: boolean | null;
  onDismissStart: () => void;
  onDragRevealIcon: () => void;
  onDragSnapBack: () => void;
  onDismissComplete: () => void;
  onOpenApp: (appId: ProfileAppId, rect: DOMRect) => void;
  onPreloadModule: (module: ProfileModuleKey) => void;
  children: React.ReactNode;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();
  const [dragEnabled, setDragEnabled] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);
  const [restLayout, setRestLayout] = useState<SheetRestLayout | null>(null);

  const morphOrigin = useMemo(() => {
    const iconRect = resolveIconRect(activeApp, launchRect);
    if (!iconRect || !restLayout) return "50% 50%";
    return sheetTransformOriginFromLayout(restLayout, iconRect);
  }, [activeApp, launchRect, restLayout]);

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const scale = useMotionValue(1);
  const radius = useMotionValue(IOS_SHEET_OPEN_RADIUS_PX);
  const sheetOpacity = useMotionValue(1);
  const contentOpacity = useMotionValue(1);
  const backdropOpacity = useMotionValue(0);
  const dockOpacity = useMotionValue(0);

  const borderRadius = useTransform(radius, (value) => `${value}px`);
  const dragRevealStarted = useRef(false);

  const dragMotionValues = useMemo(
    () => ({
      x,
      y,
      scale,
      radius,
      contentOpacity,
      backdropOpacity,
      dockOpacity,
    }),
    [x, y, scale, radius, contentOpacity, backdropOpacity, dockOpacity],
  );

  const snapOpen = useCallback(() => {
    dragRevealStarted.current = false;
    onDragSnapBack();
    void Promise.all([
      animate(x, 0, IOS_APP_DRAG_SNAP_BACK_TRANSITION),
      animate(y, 0, IOS_APP_DRAG_SNAP_BACK_TRANSITION),
      animate(scale, 1, IOS_APP_DRAG_SNAP_BACK_TRANSITION),
      animate(radius, IOS_SHEET_OPEN_RADIUS_PX, IOS_APP_DRAG_SNAP_BACK_TRANSITION),
      animate(contentOpacity, 1, IOS_APP_DRAG_SNAP_BACK_TRANSITION),
      animate(backdropOpacity, 1, IOS_APP_DRAG_SNAP_BACK_TRANSITION),
      animate(dockOpacity, 1, IOS_APP_DRAG_SNAP_BACK_TRANSITION),
    ]);
  }, [x, y, scale, radius, contentOpacity, backdropOpacity, dockOpacity, onDragSnapBack]);

  const dismissToIcon = useCallback(async () => {
    if (isDismissing) return;
    setIsDismissing(true);
    setDragEnabled(false);
    onDismissStart();

    if (reduceMotion || !sheetRef.current) {
      onDismissComplete();
      return;
    }

    const iconRect = resolveIconRect(activeApp, launchRect);
    const layout = restLayout ?? captureSheetRestLayout(sheetRef.current);

    if (!iconRect) {
      onDismissComplete();
      return;
    }

    const { targetX, targetY, targetScale, targetRadius } = computeIconMorphTargets(
      layout,
      iconRect,
    );

    await Promise.all([
      animate(x, targetX, IOS_APP_CLOSE_TRANSITION),
      animate(y, targetY, IOS_APP_CLOSE_TRANSITION),
      animate(scale, targetScale, IOS_APP_CLOSE_TRANSITION),
      animate(radius, targetRadius, IOS_APP_CLOSE_TRANSITION),
      animate(contentOpacity, 0, { duration: 0.12, ease: "easeOut" }),
      animate(backdropOpacity, 0, { duration: 0.2, ease: "easeOut" }),
      animate(dockOpacity, 0, { duration: 0.16, ease: "easeOut" }),
    ]);

    await animate(sheetOpacity, 0, { duration: 0.08, ease: "easeOut" });

    onDismissComplete();
  }, [
    activeApp,
    isDismissing,
    launchRect,
    onDismissComplete,
    onDismissStart,
    reduceMotion,
    restLayout,
    x,
    y,
    scale,
    radius,
    contentOpacity,
    sheetOpacity,
    backdropOpacity,
    dockOpacity,
  ]);

  useEffect(() => {
    setIsDismissing(false);
    setDragEnabled(false);
    setRestLayout(null);
    dragRevealStarted.current = false;
    x.set(0);
    y.set(0);
    radius.set(IOS_SHEET_OPEN_RADIUS_PX);
    contentOpacity.set(1);

    if (reduceMotion) {
      scale.set(1);
      sheetOpacity.set(1);
      backdropOpacity.set(1);
      dockOpacity.set(1);
      requestAnimationFrame(() => {
        if (sheetRef.current) {
          setRestLayout(captureSheetRestLayout(sheetRef.current));
        }
        setDragEnabled(true);
      });
      return;
    }

    scale.set(0.86);
    sheetOpacity.set(0);
    backdropOpacity.set(0);
    dockOpacity.set(0);

    void Promise.all([
      animate(scale, 1, IOS_APP_OPEN_TRANSITION),
      animate(sheetOpacity, 1, { duration: 0.22, ease: "easeOut" }),
      animate(backdropOpacity, 1, { duration: 0.28, ease: "easeOut" }),
      animate(dockOpacity, 1, { duration: 0.32, ease: "easeOut" }),
    ]).then(() => {
      if (sheetRef.current) {
        setRestLayout(captureSheetRestLayout(sheetRef.current));
      }
      setDragEnabled(true);
    });
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
      onDragRevealIcon();
    }
  };

  const handleDragEnd = (_event: PointerEvent, info: PanInfo) => {
    if (isDismissing) return;

    if (
      info.offset.y > SWIPE_CLOSE_OFFSET_PX ||
      info.velocity.y > SWIPE_CLOSE_VELOCITY
    ) {
      void dismissToIcon();
      return;
    }

    snapOpen();
  };

  return (
    <>
      <m.button
        type="button"
        aria-label="App schließen"
        className="fixed inset-0 z-[55] bg-black/30 backdrop-blur-[3px]"
        style={{ opacity: backdropOpacity, pointerEvents: isDismissing ? "none" : "auto" }}
        onClick={() => void dismissToIcon()}
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
        className={PROFILE_APP_SHEET_CLASS}
        style={{
          x,
          y,
          scale,
          opacity: sheetOpacity,
          borderRadius,
          transformOrigin: morphOrigin,
        }}
      >
        <header
          className="flex shrink-0 touch-none cursor-grab flex-col items-center border-b border-border/40 px-4 pb-3 pt-3 active:cursor-grabbing"
          onPointerDown={(event) => {
            if (reduceMotion || isDismissing || !dragEnabled) return;
            dragControls.start(event);
          }}
        >
          <div
            className="mb-3 h-1 w-10 rounded-full bg-muted-foreground/45"
            aria-hidden
          />
          <AnimatePresence mode="wait" initial={false}>
            <m.div
              key={activeApp}
              initial={reduceMotion ? false : { opacity: 0, y: 6 }}
              animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="w-full text-center"
            >
              <h2 className="truncate text-base font-semibold tracking-tight">
                {definition.label}
              </h2>
              <p className="truncate text-xs text-muted-foreground">
                {definition.subtitle}
              </p>
            </m.div>
          </AnimatePresence>
        </header>

        <div className="relative min-h-0 flex-1 overflow-hidden">
          <m.div className="absolute inset-0" style={{ opacity: contentOpacity }}>
            <AnimatePresence mode="sync" initial={false} custom={switchDirection}>
              <m.div
                key={activeApp}
                custom={switchDirection}
                variants={reduceMotion ? undefined : iosAppHorizontalPushVariants}
                initial={reduceMotion ? false : "enter"}
                animate={reduceMotion ? undefined : "center"}
                exit={reduceMotion ? undefined : "exit"}
                transition={IOS_APP_SWITCH_TRANSITION}
                className="absolute inset-0 overflow-y-auto overscroll-contain"
              >
                {children}
              </m.div>
            </AnimatePresence>
          </m.div>
        </div>
      </m.div>

      <m.nav
        style={{ opacity: dockOpacity }}
        className="fixed inset-x-4 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[65] mx-auto max-w-md"
        aria-label="App-Wechsler"
      >
        <div className="flex items-center justify-center gap-2 rounded-[1.75rem] border border-white/20 bg-background/75 p-2 shadow-2xl backdrop-blur-2xl dark:border-white/10">
          {apps.map((app) => {
            const Icon = app.icon;
            const active = activeApp === app.id;
            return (
              <button
                key={app.id}
                type="button"
                onClick={() => {
                  const iconRect = getLauncherIconRect(app.id);
                  if (iconRect) onOpenApp(app.id, iconRect);
                }}
                onPointerEnter={() => {
                  if (app.module) onPreloadModule(app.module);
                }}
                className={cn(
                  "relative flex size-12 items-center justify-center rounded-[1rem] transition-transform active:scale-95",
                  active
                    ? cn(
                        "bg-gradient-to-br shadow-md ring-1 ring-white/30",
                        app.gradient,
                      )
                    : "bg-muted/50 opacity-70 hover:opacity-100",
                )}
                aria-label={app.label}
                aria-current={active ? "true" : undefined}
              >
                <Icon
                  className={cn(
                    "size-5",
                    active ? "text-white" : "text-foreground",
                  )}
                />
              </button>
            );
          })}
        </div>
      </m.nav>
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
  skipEnterAnimation,
  reduceMotion,
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
  skipEnterAnimation?: boolean;
  reduceMotion: boolean | null;
}) {
  if (appId === "info") {
    const infoClassName = "space-y-4 p-4 pb-8 sm:p-5";
    const sectionClassName =
      "rounded-2xl border border-border/50 bg-card/80 p-5 shadow-card backdrop-blur-sm";

    if (skipEnterAnimation || reduceMotion) {
      return (
        <ProfileInfoSections
          profile={profile}
          addressLine={addressLine}
          mapsUrl={mapsUrl}
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
        <ProfileInfoSections
          profile={profile}
          addressLine={addressLine}
          mapsUrl={mapsUrl}
          sectionClassName={sectionClassName}
          contactSectionVariants={reduceMotion ? undefined : profileTabItemVariants}
          hoursSectionVariants={reduceMotion ? undefined : profileTabItemVariants}
          socialSectionVariants={reduceMotion ? undefined : profileTabItemVariants}
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
          showLoading={!reservation && loading.reservation}
          error={errors.reservation}
        >
          {reservation ? (
            <div className={cardClass}>
              <EmbedReservationWidget
                config={reservation}
                countries={publicCountries()}
              />
            </div>
          ) : null}
        </ModulePanel>
      </div>
    );
  }

  if (appId === "menu") {
    return (
      <div className="p-4 pb-8 sm:p-5">
        <ModulePanel showLoading={!menu && loading.menu} error={errors.menu}>
          {menu ? (
            <div className={cardClass}>
              <EmbedMenuWidget
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
      <ModulePanel showLoading={!reviews && loading.reviews} error={errors.reviews}>
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
}: {
  profile: PublicRestaurantProfile;
}) {
  const reduceMotion = useReducedMotion();
  const { cache, state, loadModule, preloadModules } = useProfileModuleCache(
    profile.slug,
  );
  const backgroundStarted = useRef(false);
  const [portalReady, setPortalReady] = useState(false);

  const apps = useMemo(
    () => profileAppsForModules(profile.modules),
    [profile.modules],
  );

  const [activeApp, setActiveApp] = useState<ProfileAppId | null>(null);
  const [launchRect, setLaunchRect] = useState<DOMRect | null>(null);
  const [revealingIcon, setRevealingIcon] = useState(false);
  const [switchDirection, setSwitchDirection] = useState(1);

  const openApp = useCallback(
    (appId: ProfileAppId, rect: DOMRect) => {
      const app = apps.find((a) => a.id === appId);
      if (!app) return;

      if (activeApp) {
        const oldIdx = apps.findIndex((a) => a.id === activeApp);
        const newIdx = apps.findIndex((a) => a.id === appId);
        setSwitchDirection(newIdx >= oldIdx ? 1 : -1);
        const iconRect = getLauncherIconRect(appId);
        if (iconRect) setLaunchRect(iconRect);
      } else {
        setLaunchRect(rect);
      }

      setActiveApp(appId);
      if (app.module) void loadModule(app.module);
    },
    [activeApp, apps, loadModule],
  );

  const handleDismissStart = useCallback(() => {
    setRevealingIcon(true);
  }, []);

  const handleDragRevealIcon = useCallback(() => {
    setRevealingIcon(true);
  }, []);

  const handleDragSnapBack = useCallback(() => {
    setRevealingIcon(false);
  }, []);

  const handleDismissComplete = useCallback(() => {
    setActiveApp(null);
    setRevealingIcon(false);
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
    return scheduleProfileBackgroundWork(startBackgroundPreload);
  }, [startBackgroundPreload]);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  const addressLine = formatPublicRestaurantAddress(profile);
  const mapsUrl = publicRestaurantMapsUrl(profile);

  const reservation = cache.reservation as PublicEmbedRestaurant | null;
  const menu = cache.menu as PublicEmbedMenu | null;
  const reviews = cache.reviews as PublicEmbedReviews | null;

  const activeDefinition = apps.find((a) => a.id === activeApp);
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

  const overlay =
    portalReady
      ? createPortal(
          <AnimatePresence
            onExitComplete={() => {
              setLaunchRect(null);
            }}
          >
            {isAppOpen && activeApp && activeDefinition ? (
              <ProfileAppSheetOverlay
                key="profile-app-overlay"
                activeApp={activeApp}
                launchRect={launchRect}
                definition={activeDefinition}
                apps={apps}
                switchDirection={switchDirection}
                reduceMotion={reduceMotion}
                onDismissStart={handleDismissStart}
                onDragRevealIcon={handleDragRevealIcon}
                onDragSnapBack={handleDragSnapBack}
                onDismissComplete={handleDismissComplete}
                onOpenApp={openApp}
                onPreloadModule={(module) => {
                  void loadModule(module, { silent: true });
                }}
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
                  skipEnterAnimation
                  reduceMotion={reduceMotion}
                />
              </ProfileAppSheetOverlay>
            ) : null}
          </AnimatePresence>,
          document.body,
        )
      : null;

  return (
    <LazyMotion features={domMax}>
      <div className="mx-auto max-w-3xl px-4 pb-20 sm:px-6">
        <div className="relative mt-6 px-2 sm:px-4">
          <m.ul
            className="grid grid-cols-4 justify-items-center gap-x-2 gap-y-6 sm:gap-x-3"
            initial={reduceMotion ? false : "hidden"}
            animate={reduceMotion ? undefined : "visible"}
            variants={{
              visible: { transition: { staggerChildren: 0.05 } },
            }}
          >
            {apps.map((app, index) => (
              <ProfileAppIconTile
                key={app.id}
                app={app}
                index={index}
                accentHex={profile.accentHex}
                isHidden={isAppOpen && activeApp === app.id && !revealingIcon}
                onOpen={(rect) => openApp(app.id, rect)}
                reduceMotion={reduceMotion}
              />
            ))}
          </m.ul>
        </div>
      </div>
      {overlay}
    </LazyMotion>
  );
}
