"use client";

import { BarChart3 } from "lucide-react";
import {
  DashboardCompactInlineMetrics,
  DashboardCompactMetricPill,
} from "@/components/dashboard/dashboard-compact-list";
import { DashboardWidgetShell } from "@/components/dashboard/dashboard-widget-shell";
import { useDashboardModuleBatchStats } from "@/lib/hooks/use-dashboard-module-batch-stats";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";

export function DashboardInsightsTile() {
  const { summary, loading, error, ready } =
    useDashboardModuleBatchStats("insights");
  const showSkeleton = useDeferredSkeleton(!ready || (loading && !summary));

  return (
    <DashboardWidgetShell
      title="Insights"
      icon={
        <BarChart3
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
      }
      href="/dashboard/insights/uebersicht"
      linkLabel="Zu Insights"
      ready={ready}
      loading={showSkeleton}
      error={error}
    >
      <DashboardCompactInlineMetrics>
        <DashboardCompactMetricPill
          label="Res. 30 Tage"
          value={String(summary?.reservations30d ?? 0)}
        />
        <DashboardCompactMetricPill
          label="Ø Bewertung"
          value={
            summary?.avgRating != null
              ? summary.avgRating.toLocaleString("de-DE", {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                })
              : "—"
          }
        />
        <DashboardCompactMetricPill
          label="Nachrichten 30 T."
          value={String(summary?.messages30d ?? 0)}
        />
      </DashboardCompactInlineMetrics>
    </DashboardWidgetShell>
  );
}
