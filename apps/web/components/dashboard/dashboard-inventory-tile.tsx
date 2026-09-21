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
  const deliveriesDueToday = summary?.deliveriesDueToday ?? 0;
  const deliveriesOverdue = summary?.deliveriesOverdue ?? 0;
  const deliveryDueTotal = deliveriesDueToday + deliveriesOverdue;

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
          label="Lieferung fällig"
          value={
            deliveryDueTotal > 0
              ? [
                  deliveriesOverdue > 0 ? `${deliveriesOverdue} überfällig` : null,
                  deliveriesDueToday > 0 ? `${deliveriesDueToday} heute` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : "0"
          }
          href="/dashboard/inventory/bestellung"
          highlight={deliveryDueTotal > 0}
        />
        <DashboardCompactMetricPill
          label="Bestellungen"
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
