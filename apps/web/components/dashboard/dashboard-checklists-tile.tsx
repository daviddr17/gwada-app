"use client";

import { ListChecks } from "lucide-react";
import {
  DashboardCompactInlineMetrics,
  DashboardCompactMetricPill,
} from "@/components/dashboard/dashboard-compact-list";
import { DashboardWidgetShell } from "@/components/dashboard/dashboard-widget-shell";
import { useDashboardModuleBatchStats } from "@/lib/hooks/use-dashboard-module-batch-stats";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";

export function DashboardChecklistsTile() {
  const { summary, loading, error, ready } =
    useDashboardModuleBatchStats("checklists");
  const showSkeleton = useDeferredSkeleton(!ready || (loading && !summary));
  const overdue = summary?.overdueTodos ?? 0;

  return (
    <DashboardWidgetShell
      title="Checklisten"
      icon={
        <ListChecks
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
      }
      href="/dashboard/checklisten"
      linkLabel="Zu Checklisten"
      ready={ready}
      loading={showSkeleton}
      error={error}
    >
      <DashboardCompactInlineMetrics>
        <DashboardCompactMetricPill
          label="Offen"
          value={String(summary?.openTodos ?? 0)}
        />
        <DashboardCompactMetricPill
          label="Überfällig"
          value={String(overdue)}
          highlight={overdue > 0}
        />
        <DashboardCompactMetricPill
          label="Heute erfasst"
          value={String(summary?.capturesToday ?? 0)}
        />
      </DashboardCompactInlineMetrics>
    </DashboardWidgetShell>
  );
}
