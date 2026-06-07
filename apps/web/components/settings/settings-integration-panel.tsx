"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { IntegrationCollapsiblePanel } from "@/components/ui/integration-collapsible-panel";
import { Skeleton, SkeletonCardFrame } from "@/components/ui/skeleton";

export function integrationStatusBadgeConnected(label = "Verbunden") {
  return (
    <Badge
      variant="outline"
      className="border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
    >
      {label}
    </Badge>
  );
}

export function integrationStatusBadgeMuted(label: string) {
  return (
    <Badge variant="outline" className="text-muted-foreground">
      {label}
    </Badge>
  );
}

export function integrationStatusBadgeWarning(label: string) {
  return (
    <Badge variant="outline" className="border-amber-500/40 text-amber-900 dark:text-amber-100">
      {label}
    </Badge>
  );
}

export function integrationStatusBadgeDestructive(label: string) {
  return <Badge variant="destructive">{label}</Badge>;
}

export function integrationStatusBadgeSecondary(label: string) {
  return <Badge variant="secondary">{label}</Badge>;
}

export function SettingsIntegrationPanel({
  title,
  description,
  icon,
  badge,
  summaryLine,
  alertLine,
  loading,
  denied,
  deniedMessage,
  noRestaurant,
  noRestaurantMessage,
  defaultOpen = false,
  children,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  badge?: ReactNode;
  summaryLine?: ReactNode;
  alertLine?: ReactNode;
  loading?: boolean;
  denied?: boolean;
  deniedMessage?: string;
  noRestaurant?: boolean;
  noRestaurantMessage?: string;
  defaultOpen?: boolean;
  children?: ReactNode;
}) {
  const blocked = denied || noRestaurant;
  const blockedMessage =
    deniedMessage ??
    noRestaurantMessage ??
    "Diese Integration ist derzeit nicht verfügbar.";

  const loadingSkeleton = (
    <SkeletonCardFrame className="border-border/50 shadow-card">
      <div className="flex items-center gap-4 p-4">
        <Skeleton className="size-11 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-5 w-28 rounded-md" />
          <Skeleton className="h-3 w-full max-w-md rounded-md" />
        </div>
        <Skeleton className="size-5 shrink-0 rounded-md" />
      </div>
    </SkeletonCardFrame>
  );

  return (
    <IntegrationCollapsiblePanel
      title={title}
      description={description}
      icon={icon}
      badges={badge}
      defaultOpen={defaultOpen}
      loading={loading}
      loadingSkeleton={loadingSkeleton}
      collapsedSummary={summaryLine}
      openHeaderExtra={
        <>
          {summaryLine ? (
            <p className="text-sm text-muted-foreground">{summaryLine}</p>
          ) : null}
          {alertLine ? (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
              {alertLine}
            </p>
          ) : null}
        </>
      }
    >
      {blocked ? (
        <p className="text-sm text-muted-foreground">{blockedMessage}</p>
      ) : (
        children
      )}
    </IntegrationCollapsiblePanel>
  );
}
