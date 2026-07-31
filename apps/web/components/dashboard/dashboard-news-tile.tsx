"use client";

import { Newspaper } from "lucide-react";
import {
  DashboardCompactInlineMetrics,
  DashboardCompactMetricPill,
} from "@/components/dashboard/dashboard-compact-list";
import { DashboardWidgetShell } from "@/components/dashboard/dashboard-widget-shell";
import { useDashboardModuleBatchStats } from "@/lib/hooks/use-dashboard-module-batch-stats";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";

export function DashboardNewsTile() {
  const { summary, loading, error, ready } = useDashboardModuleBatchStats("news");
  const showSkeleton = useDeferredSkeleton(!ready || (loading && !summary));

  return (
    <DashboardWidgetShell
      title="News"
      icon={
        <Newspaper
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
      }
      href="/dashboard/news/uebersicht"
      linkLabel="Zu News"
      ready={ready}
      loading={showSkeleton}
      error={error}
    >
      <DashboardCompactInlineMetrics>
        <DashboardCompactMetricPill
          label="Veröffentlicht"
          value={String(summary?.published ?? 0)}
        />
        <DashboardCompactMetricPill
          label="Geplant"
          value={String(summary?.scheduled ?? 0)}
          highlight={(summary?.scheduled ?? 0) > 0}
        />
        <DashboardCompactMetricPill
          label="Entwürfe"
          value={String(summary?.draft ?? 0)}
        />
      </DashboardCompactInlineMetrics>
    </DashboardWidgetShell>
  );
}
