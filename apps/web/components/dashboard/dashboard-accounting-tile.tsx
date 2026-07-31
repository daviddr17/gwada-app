"use client";

import { Receipt } from "lucide-react";
import {
  DashboardCompactInlineMetrics,
  DashboardCompactMetricPill,
} from "@/components/dashboard/dashboard-compact-list";
import { DashboardWidgetShell } from "@/components/dashboard/dashboard-widget-shell";
import { useDashboardModuleBatchStats } from "@/lib/hooks/use-dashboard-module-batch-stats";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";

export function DashboardAccountingTile() {
  const { summary, loading, error, ready } =
    useDashboardModuleBatchStats("accounting");
  const showSkeleton = useDeferredSkeleton(!ready || (loading && !summary));
  const openInvoices = summary?.openInvoices ?? 0;

  return (
    <DashboardWidgetShell
      title="Buchführung"
      icon={
        <Receipt className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      }
      href="/dashboard/buchfuehrung/rechnungen"
      linkLabel="Zur Buchführung"
      ready={ready}
      loading={showSkeleton}
      error={error}
    >
      <DashboardCompactInlineMetrics>
        <DashboardCompactMetricPill
          label="Offene Rechnungen"
          value={String(openInvoices)}
          href="/dashboard/buchfuehrung/rechnungen"
          highlight={openInvoices > 0}
        />
        <DashboardCompactMetricPill
          label="Rechnungen 30 T."
          value={String(summary?.invoices30d ?? 0)}
        />
        <DashboardCompactMetricPill
          label="Belege 30 T."
          value={String(summary?.vouchers30d ?? 0)}
        />
      </DashboardCompactInlineMetrics>
    </DashboardWidgetShell>
  );
}
