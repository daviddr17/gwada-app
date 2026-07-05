"use client";

import { Package } from "lucide-react";
import {
  DashboardCompactInlineMetrics,
  DashboardCompactMetricPill,
} from "@/components/dashboard/dashboard-compact-list";
import { DashboardWidgetShell } from "@/components/dashboard/dashboard-widget-shell";
import { useDashboardInventoryStats } from "@/lib/hooks/use-dashboard-inventory-stats";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";

export function DashboardInventoryTile() {
  const { summary, loading, error, ready } = useDashboardInventoryStats();
  const showSkeleton = useDeferredSkeleton(!ready || (loading && !summary));

  const emptyStock = summary?.emptyStock ?? 0;
  const openOrders = summary?.openOrders ?? 0;
  const openLines = summary?.openOrderLines ?? 0;

  return (
    <DashboardWidgetShell
      title="Bestand & Bestellung"
      icon={
        <Package className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      }
      href="/dashboard/inventory/uebersicht"
      linkLabel="Zum Bestand"
      ready={ready}
      loading={showSkeleton}
      error={error}
    >
      <DashboardCompactInlineMetrics>
        <DashboardCompactMetricPill
          label="Zutaten aktiv"
          value={String(summary?.ingredientsActive ?? 0)}
        />
        <DashboardCompactMetricPill
          label="Leerer Bestand"
          value={String(emptyStock)}
          href="/dashboard/inventory/uebersicht"
          highlight={emptyStock > 0}
        />
        <DashboardCompactMetricPill
          label="Offene Bestellungen"
          value={
            openOrders > 0
              ? `${openOrders} · ${openLines} Pos.`
              : String(openOrders)
          }
          href="/dashboard/inventory/bestellung"
          highlight={openOrders > 0}
        />
      </DashboardCompactInlineMetrics>
    </DashboardWidgetShell>
  );
}
