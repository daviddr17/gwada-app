"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { AppNavLink } from "@/components/navigation/app-nav-link";
import { ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton, SkeletonCardFrame } from "@/components/ui/skeleton";
import { DashboardCompactMetricsSkeleton } from "@/components/dashboard/dashboard-compact-list";
import {
  DASHBOARD_WIDGET_PRESS_SCALE,
  DASHBOARD_WIDGET_PRESS_SPRING,
  dashboardWidgetPrimaryElevationClassName,
  dashboardWidgetSoftElevationClassName,
} from "@/lib/ui/dashboard-widget-polish";

function DashboardWidgetSkeletonFrame({
  isCompact,
  emphasis = "default",
}: {
  isCompact: boolean;
  emphasis?: "default" | "primary";
}) {
  return (
    <SkeletonCardFrame
      className={cn(
        "min-w-0",
        emphasis === "primary"
          ? dashboardWidgetPrimaryElevationClassName
          : dashboardWidgetSoftElevationClassName,
      )}
    >
      <div className="flex items-center justify-between gap-2 pb-3">
        <Skeleton
          className={cn(
            "rounded-md",
            emphasis === "primary" ? "h-7 w-40" : "h-5 w-32",
          )}
        />
        <Skeleton className="size-8 rounded-lg" />
      </div>
      <DashboardCompactMetricsSkeleton count={isCompact ? 3 : 4} />
    </SkeletonCardFrame>
  );
}

export function DashboardWidgetShell({
  title,
  description,
  caption,
  icon,
  href,
  linkLabel = "Öffnen",
  variant = "compact",
  emphasis = "default",
  background,
  ready,
  loading,
  error,
  children,
  /** Statischer Modultitel — Header sofort, Skeleton nur im Inhalt (z. B. Nachrichten). */
  staticChrome = false,
  /** Eigener Lade-Inhalt statt generischer Metrik-Pills. */
  loadingContent,
  /** Zusätzliche Karten-Klassen (z. B. Heute-Hervorhebung). */
  cardClassName,
  onPress,
  pressAriaLabel,
}: {
  title: string;
  description?: string;
  /** Kleine Overline über dem Titel (z. B. „Tagesüberblick“ bei Heute). */
  caption?: string;
  icon?: ReactNode;
  /** Fehlt = reine Anzeige, kein Navigations-Pfeil. */
  href?: string;
  linkLabel?: string;
  variant?: "default" | "compact";
  /** Primär = Heute-Hierarchie vs. Modul-Karten. */
  emphasis?: "default" | "primary";
  /** Hintergrund über die gesamte Karte (z. B. Wetter-Ambience). */
  background?: ReactNode;
  ready: boolean;
  loading: boolean;
  error: string | null;
  children: ReactNode;
  staticChrome?: boolean;
  loadingContent?: ReactNode;
  cardClassName?: string;
  onPress?: () => void;
  pressAriaLabel?: string;
}) {
  const isCompact = variant === "compact";
  const isPrimary = emphasis === "primary";
  const reduceMotion = useReducedMotion() ?? false;
  const hasContent = children != null && children !== false;
  const showContentSkeleton = error == null && (loading || !hasContent);

  if (!staticChrome && !ready) {
    return (
      <DashboardWidgetSkeletonFrame
        isCompact={isCompact}
        emphasis={emphasis}
      />
    );
  }

  const layered = Boolean(background);
  const interactive = Boolean(onPress);
  const showDescription = Boolean(description) && (isPrimary || !isCompact);

  const card = (
    <Card
      className={cn(
        "min-w-0",
        isPrimary
          ? dashboardWidgetPrimaryElevationClassName
          : dashboardWidgetSoftElevationClassName,
        cardClassName,
        layered && "relative isolate overflow-hidden",
        interactive && "cursor-pointer hover:bg-muted/25",
      )}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? pressAriaLabel ?? title : undefined}
      onClick={interactive ? onPress : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onPress?.();
              }
            }
          : undefined
      }
    >
      {background}
      <CardHeader
        className={cn(
          "shrink-0",
          isCompact
            ? cn(
                "flex flex-row items-start justify-between gap-2 space-y-0 px-4",
                isPrimary ? "py-4" : "items-center py-3",
              )
            : "flex flex-col gap-3 pb-2 sm:flex-row sm:items-start sm:justify-between sm:space-y-0",
          layered && "relative z-10",
        )}
      >
        <div className={cn("min-w-0", (isPrimary || !isCompact) && "space-y-1")}>
          {caption ? (
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              {caption}
            </p>
          ) : null}
          <CardTitle
            className={cn(
              "flex items-center gap-2 text-foreground",
              isPrimary
                ? "text-2xl font-bold tracking-tight sm:text-[1.75rem]"
                : isCompact
                  ? "text-[0.9375rem] font-semibold tracking-tight sm:text-base"
                  : "text-lg font-semibold tracking-tight",
            )}
          >
            {icon}
            {title}
          </CardTitle>
          {showDescription ? (
            <CardDescription
              className={cn(isPrimary && "text-sm text-muted-foreground")}
            >
              {description}
            </CardDescription>
          ) : null}
        </div>
        {href ? (
          <AppNavLink
            href={href}
            aria-label={linkLabel}
            className={cn(
              buttonVariants({
                variant: "ghost",
                size: isCompact ? "icon-sm" : "sm",
              }),
              isCompact
                ? "size-8 shrink-0 rounded-lg text-muted-foreground"
                : "h-9 shrink-0 gap-1 rounded-xl",
              isPrimary && isCompact && "mt-0.5",
            )}
          >
            {isCompact ? (
              <ChevronRight className="size-4" aria-hidden />
            ) : (
              <>
                {linkLabel}
                <ChevronRight className="size-4" aria-hidden />
              </>
            )}
          </AppNavLink>
        ) : interactive ? (
          <span
            className={cn(
              buttonVariants({
                variant: "ghost",
                size: isCompact ? "icon-sm" : "sm",
              }),
              isCompact
                ? "size-8 shrink-0 rounded-lg text-muted-foreground pointer-events-none"
                : "h-9 shrink-0 gap-1 rounded-xl pointer-events-none",
              isPrimary && isCompact && "mt-0.5",
            )}
            aria-hidden
          >
            <ChevronRight className="size-4" />
          </span>
        ) : null}
      </CardHeader>
      <CardContent
        className={cn(
          isCompact ? "px-4 pb-4 pt-0" : "pt-0",
          isPrimary && isCompact && "pb-5",
          layered && "relative z-10",
        )}
      >
        {error ? (
          <p className="text-sm text-muted-foreground">
            {typeof error === "string" ? error : "Laden fehlgeschlagen."}
          </p>
        ) : showContentSkeleton ? (
          <div aria-busy="true" aria-label={`${title} wird geladen`}>
            {loadingContent ?? (
              <DashboardCompactMetricsSkeleton count={isCompact ? 3 : 4} />
            )}
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );

  if (!interactive || reduceMotion) {
    return card;
  }

  return (
    <motion.div
      className="min-w-0 origin-center will-change-transform"
      whileTap={{ scale: DASHBOARD_WIDGET_PRESS_SCALE }}
      transition={DASHBOARD_WIDGET_PRESS_SPRING}
    >
      {card}
    </motion.div>
  );
}
