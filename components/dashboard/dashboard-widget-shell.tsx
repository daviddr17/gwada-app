"use client";

import type { ReactNode } from "react";
import Link from "next/link";
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
}) {
  const isCompact = variant === "compact";

  if (!ready) {
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
            render={<Link href={href} prefetch />}
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
        ) : loading ? (
          <div aria-busy="true" aria-label={`${title} wird geladen`}>
            <DashboardCompactMetricsSkeleton count={isCompact ? 3 : 4} />
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}
