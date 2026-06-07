"use client";

import { m } from "framer-motion";
import { useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ProfileAppDefinition, ProfileAppId } from "@/lib/public-profile/profile-app-config";
import {
  IOS_DOCK_HIGHLIGHT_TRANSITION,
  PROFILE_DOCK_ICON_HIGHLIGHT_PX,
  PROFILE_DOCK_ICON_SLOT_PX,
  profileDockIconHighlightX,
} from "@/lib/public-profile/profile-dock-motion";
import {
  profileDockActiveBgClassName,
  profileDockHighlightClassName,
  profileDockIconButtonClassName,
  profileDockIconContainerClassName,
  profileDockShellClassName,
  profileDockTooltipContentClassName,
} from "@/lib/public-profile/profile-dock-styles";
import { cn } from "@/lib/utils";

/** Safari: deckende Fläche ohne backdrop-filter — Glas nur als optische Border/Schatten. */
const glassPlateClassName = cn(
  "pointer-events-none absolute inset-0 z-0",
  profileDockShellClassName,
  "border border-white/50 bg-white/92",
  "shadow-[0_12px_40px_-12px_rgba(0,0,0,0.28)]",
  "ring-1 ring-black/8 dark:ring-white/12",
  "dark:border-white/20 dark:bg-neutral-900/92",
  "dark:shadow-[0_14px_44px_-12px_rgba(0,0,0,0.65)]",
);

function DockIconButton({
  app,
  hidden,
  isActive,
  showTooltip,
  tooltipAboveSheet,
  onSelect,
  onHover,
  onPreload,
}: {
  app: ProfileAppDefinition;
  hidden: boolean;
  isActive: boolean;
  showTooltip: boolean;
  tooltipAboveSheet: boolean;
  onSelect: (rect: DOMRect) => void;
  onHover: () => void;
  onPreload?: () => void;
}) {
  const Icon = app.icon;

  const button = (
    <button
      type="button"
      data-profile-launcher-icon={app.id}
      aria-label={app.label}
      aria-current={isActive ? "true" : undefined}
      aria-hidden={hidden}
      tabIndex={hidden ? -1 : 0}
      className={cn(
        profileDockIconButtonClassName,
        isActive && "text-foreground",
        hidden && "pointer-events-none opacity-0",
      )}
      style={{
        width: PROFILE_DOCK_ICON_SLOT_PX,
        height: PROFILE_DOCK_ICON_SLOT_PX,
      }}
      onClick={(event) => onSelect(event.currentTarget.getBoundingClientRect())}
      onPointerEnter={() => {
        onHover();
        onPreload?.();
      }}
      onTouchStart={() => {
        onPreload?.();
      }}
    >
      <Icon className="size-[22px] shrink-0" strokeWidth={1.85} />
    </button>
  );

  if (!showTooltip || hidden) {
    return button;
  }

  return (
    <Tooltip>
      <TooltipTrigger delay={280} render={button} />
      <TooltipContent
        side="top"
        sideOffset={10}
        showArrow={false}
        positionerClassName={
          tooltipAboveSheet ? "z-[10000]" : undefined
        }
        className={cn(
          "max-w-none gap-0 data-open:zoom-in-100 data-closed:zoom-out-100",
          profileDockTooltipContentClassName,
        )}
      >
        {app.label}
      </TooltipContent>
    </Tooltip>
  );
}

export function ProfileIconDock({
  apps,
  activeAppId,
  reduceMotion,
  onSelectApp,
  onPreloadModule,
  className,
  hiddenAppIds = [],
  showIconTooltips = false,
  tooltipAboveSheet = false,
}: {
  apps: ProfileAppDefinition[];
  activeAppId?: ProfileAppId | null;
  reduceMotion?: boolean | null;
  onSelectApp: (appId: ProfileAppId, rect?: DOMRect) => void;
  onPreloadModule?: (module: NonNullable<ProfileAppDefinition["module"]>) => void;
  className?: string;
  hiddenAppIds?: ProfileAppId[];
  showIconTooltips?: boolean;
  tooltipAboveSheet?: boolean;
}) {
  const activeIndex =
    activeAppId != null
      ? apps.findIndex((app) => app.id === activeAppId)
      : -1;
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const highlightIndex =
    hoverIndex ?? (activeIndex >= 0 ? activeIndex : null);

  const highlightX =
    highlightIndex != null ? profileDockIconHighlightX(highlightIndex) : 0;

  if (apps.length === 0) {
    return null;
  }

  return (
    <nav
      className={cn("flex justify-center px-4", className)}
      aria-label="Restaurant-Module"
      onPointerLeave={() => setHoverIndex(null)}
    >
      <div
        className={cn(
          "relative inline-flex items-center",
          profileDockShellClassName,
          profileDockIconContainerClassName,
        )}
      >
        <div className={glassPlateClassName} aria-hidden />
        <div className="relative z-[1] inline-flex items-center gap-1">
          {highlightIndex != null ? (
            reduceMotion ? (
              <div
                aria-hidden
                className={cn(
                  "pointer-events-none absolute top-1/2 size-11 -translate-y-1/2 transition-[left] duration-300 ease-out",
                  profileDockHighlightClassName,
                  profileDockActiveBgClassName,
                )}
                style={{ left: highlightX }}
              />
            ) : (
              <m.div
                aria-hidden
                className={cn(
                  "pointer-events-none absolute top-1/2 -translate-y-1/2",
                  profileDockHighlightClassName,
                  profileDockActiveBgClassName,
                )}
                style={{
                  width: PROFILE_DOCK_ICON_HIGHLIGHT_PX,
                  height: PROFILE_DOCK_ICON_HIGHLIGHT_PX,
                }}
                initial={false}
                animate={{ x: highlightX }}
                transition={IOS_DOCK_HIGHLIGHT_TRANSITION}
              />
            )
          ) : null}

          {apps.map((app, index) => (
            <DockIconButton
              key={app.id}
              app={app}
              hidden={hiddenAppIds.includes(app.id)}
              isActive={app.id === activeAppId}
              showTooltip={showIconTooltips}
              tooltipAboveSheet={tooltipAboveSheet}
              onSelect={(rect) => onSelectApp(app.id, rect)}
              onHover={() => setHoverIndex(index)}
              onPreload={
                app.module ? () => onPreloadModule?.(app.module!) : undefined
              }
            />
          ))}
        </div>
      </div>
    </nav>
  );
}
