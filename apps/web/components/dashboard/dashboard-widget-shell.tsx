"use client";

import type { ReactNode } from "react";
import { AppNavLink } from "@/components/navigation/app-nav-link";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
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

function DashboardWidgetSkeletonFrame({
  isCompact,
}: {
  isCompact: boolean;
}) {
  return (
    <SkeletonCardFrame className="min-w-0 border-border/50 shadow-card">
      <div className="flex items-center justify-between gap-2 pb-3">
        <Skeleton className="h-5 w-32 rounded-md" />
        <Skeleton className="size-8 rounded-lg" />
      </div>
      <DashboardCompactMetricsSkeleton count={isCompact ? 3 : 4} />
    </SkeletonCardFrame>
  );
}

export function DashboardWidgetShell({
  title,
  description,
  icon,
  href,
  linkLabel = "Öffnen",
  variant = "compact",
  background,
  ready,
  loading,
  error,
  children,
  /** Statischer Modultitel — Header sofort, Skeleton nur im Inhalt (z. B. Nachrichten). */
  staticChrome = false,
  /** Eigener Lade-Inhalt statt generischer Metrik-Pills. */
  loadingContent,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  /** Fehlt = reine Anzeige, kein Navigations-Pfeil. */
  href?: string;
  linkLabel?: string;
  variant?: "default" | "compact";
  /** Hintergrund über die gesamte Karte (z. B. Wetter-Ambience). */
  background?: ReactNode;
  ready: boolean;
  loading: boolean;
  error: string | null;
  children: ReactNode;
  staticChrome?: boolean;
  loadingContent?: ReactNode;
}) {
  const isCompact = variant === "compact";
  const hasContent = children != null && children !== false;
  const showContentSkeleton = error == null && (loading || !hasContent);

  if (!staticChrome && !ready) {
    return <DashboardWidgetSkeletonFrame isCompact={isCompact} />;
  }

  const layered = Boolean(background);

  return (
    <Card
      className={cn(
        "min-w-0 border-border/50 shadow-card",
        layered && "relative overflow-hidden",
      )}
    >
      {background}
      <CardHeader
        className={cn(
          isCompact
            ? "flex flex-row items-center justify-between gap-2 space-y-0 px-4 py-3"
            : "flex flex-col gap-3 pb-2 sm:flex-row sm:items-start sm:justify-between sm:space-y-0",
          layered && "relative z-10",
        )}
      >
        <div className={isCompact ? "min-w-0" : "space-y-1"}>
          <CardTitle
            className={
              isCompact
                ? "flex items-center gap-2 text-base font-semibold"
                : "flex items-center gap-2 text-lg"
            }
          >
            {icon}
            {title}
          </CardTitle>
          {!isCompact && description ? (
            <CardDescription>{description}</CardDescription>
          ) : null}
        </div>
        {href ? (
          <Button
            variant="ghost"
            size={isCompact ? "icon-sm" : "sm"}
            className={
              isCompact
                ? "size-8 shrink-0 rounded-lg text-muted-foreground"
                : "h-9 shrink-0 gap-1 rounded-xl"
            }
            aria-label={linkLabel}
            render={<AppNavLink href={href} prefetch={false} />}
          >
            {isCompact ? (
              <ChevronRight className="size-4" aria-hidden />
            ) : (
              <>
                {linkLabel}
                <ChevronRight className="size-4" aria-hidden />
              </>
            )}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent
        className={cn(isCompact ? "px-4 pb-4 pt-0" : "pt-0", layered && "relative z-10")}
      >
        {error ? (
          <p className="text-sm text-muted-foreground">{error}</p>
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
}
