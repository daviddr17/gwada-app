"use client";

import { UtensilsCrossed } from "lucide-react";
import {
  DashboardCompactInlineMetrics,
  DashboardCompactMetricPill,
} from "@/components/dashboard/dashboard-compact-list";
import { DashboardWidgetShell } from "@/components/dashboard/dashboard-widget-shell";
import { useDashboardMenuStats } from "@/lib/hooks/use-dashboard-menu-stats";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";

export function DashboardMenuTile() {
  const { summary, loading, error, ready } = useDashboardMenuStats();
  const showSkeleton = useDeferredSkeleton(!ready || (loading && !summary));

  return (
    <DashboardWidgetShell
      title="Speisekarte"
      icon={
        <UtensilsCrossed
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
      }
      href="/dashboard/menu/uebersicht"
      linkLabel="Zur Speisekarte"
      ready={ready}
      loading={showSkeleton}
      error={error}
    >
      {summary ? (
        <DashboardCompactInlineMetrics>
          <DashboardCompactMetricPill
            label="Gerichte aktiv"
            value={
              summary.dishesTotal !== summary.dishesActive
                ? `${summary.dishesActive} · ${summary.dishesTotal} ges.`
                : String(summary.dishesActive)
            }
          />
          <DashboardCompactMetricPill
            label="Kategorien"
            value={
              summary.topCategoryName && summary.topCategoryCount > 0
                ? `${summary.categoriesActive} · Top ${summary.topCategoryName}`
                : String(summary.categoriesActive)
            }
          />
          <DashboardCompactMetricPill
            label="Ø Preis"
            value={
              summary.avgPrice != null
                ? `${summary.avgPrice.toFixed(2)} €`
                : "—"
            }
            highlight={summary.withoutCategory > 0}
          />
          {summary.withoutCategory > 0 ? (
            <DashboardCompactMetricPill
              label="Ohne Kategorie"
              value={String(summary.withoutCategory)}
              href="/dashboard/menu/uebersicht"
              highlight
            />
          ) : null}
        </DashboardCompactInlineMetrics>
      ) : null}
    </DashboardWidgetShell>
  );
}
