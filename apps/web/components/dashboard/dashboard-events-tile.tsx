"use client";

import { CalendarRange } from "lucide-react";
import {
  DashboardCompactInlineMetrics,
  DashboardCompactMetricPill,
} from "@/components/dashboard/dashboard-compact-list";
import { DashboardWidgetShell } from "@/components/dashboard/dashboard-widget-shell";
import { useDashboardModuleBatchStats } from "@/lib/hooks/use-dashboard-module-batch-stats";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";

export function DashboardEventsTile() {
  const { summary, loading, error, ready } =
    useDashboardModuleBatchStats("events");
  const showSkeleton = useDeferredSkeleton(!ready || (loading && !summary));

  return (
    <DashboardWidgetShell
      title="Events"
      icon={
        <CalendarRange
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
      }
      href="/dashboard/events/uebersicht"
      linkLabel="Zu Events"
      ready={ready}
      loading={showSkeleton}
      error={error}
    >
      <DashboardCompactInlineMetrics>
        <DashboardCompactMetricPill
          label="Bevorstehend"
          value={String(summary?.upcoming ?? 0)}
          highlight={(summary?.upcoming ?? 0) > 0}
        />
        <DashboardCompactMetricPill
          label="Gesamt"
          value={String(summary?.total ?? 0)}
        />
        <DashboardCompactMetricPill
          label="Entwürfe"
          value={String(summary?.draft ?? 0)}
        />
      </DashboardCompactInlineMetrics>
    </DashboardWidgetShell>
  );
}
