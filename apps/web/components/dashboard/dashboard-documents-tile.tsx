"use client";

import { FileText } from "lucide-react";
import {
  DashboardCompactInlineMetrics,
  DashboardCompactMetricPill,
} from "@/components/dashboard/dashboard-compact-list";
import { DashboardWidgetShell } from "@/components/dashboard/dashboard-widget-shell";
import { formatDocumentBytes } from "@/lib/documents/compute-document-statistics";
import { useDashboardModuleBatchStats } from "@/lib/hooks/use-dashboard-module-batch-stats";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";

export function DashboardDocumentsTile() {
  const { summary, loading, error, ready } =
    useDashboardModuleBatchStats("documents");
  const showSkeleton = useDeferredSkeleton(!ready || (loading && !summary));
  const withoutTag = summary?.withoutTag ?? 0;

  return (
    <DashboardWidgetShell
      title="Dokumente"
      icon={
        <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      }
      href="/dashboard/dokumente/uebersicht"
      linkLabel="Zu Dokumente"
      ready={ready}
      loading={showSkeleton}
      error={error}
    >
      <DashboardCompactInlineMetrics>
        <DashboardCompactMetricPill
          label="Gesamt"
          value={String(summary?.total ?? 0)}
        />
        <DashboardCompactMetricPill
          label="Ohne Tag"
          value={String(withoutTag)}
          highlight={withoutTag > 0}
        />
        <DashboardCompactMetricPill
          label="Speicher"
          value={formatDocumentBytes(summary?.storageBytes ?? 0)}
        />
      </DashboardCompactInlineMetrics>
    </DashboardWidgetShell>
  );
}
