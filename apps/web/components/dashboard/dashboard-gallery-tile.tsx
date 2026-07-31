"use client";

import { Images } from "lucide-react";
import {
  DashboardCompactInlineMetrics,
  DashboardCompactMetricPill,
} from "@/components/dashboard/dashboard-compact-list";
import { DashboardWidgetShell } from "@/components/dashboard/dashboard-widget-shell";
import { formatDocumentBytes } from "@/lib/documents/compute-document-statistics";
import { useDashboardModuleBatchStats } from "@/lib/hooks/use-dashboard-module-batch-stats";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";

export function DashboardGalleryTile() {
  const { summary, loading, error, ready } =
    useDashboardModuleBatchStats("gallery");
  const showSkeleton = useDeferredSkeleton(!ready || (loading && !summary));

  return (
    <DashboardWidgetShell
      title="Galerie"
      icon={
        <Images className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      }
      href="/dashboard/galerie/uebersicht"
      linkLabel="Zur Galerie"
      ready={ready}
      loading={showSkeleton}
      error={error}
    >
      <DashboardCompactInlineMetrics>
        <DashboardCompactMetricPill
          label="Medien"
          value={String(summary?.mediaTotal ?? 0)}
        />
        <DashboardCompactMetricPill
          label="Highlights"
          value={String(summary?.highlights ?? 0)}
        />
        <DashboardCompactMetricPill
          label="Speicher"
          value={formatDocumentBytes(summary?.storageBytes ?? 0)}
        />
      </DashboardCompactInlineMetrics>
    </DashboardWidgetShell>
  );
}
