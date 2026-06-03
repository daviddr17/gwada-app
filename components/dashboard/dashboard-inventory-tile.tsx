"use client";

import { Package, ShoppingCart } from "lucide-react";
import {
  DashboardStatBlock,
  DashboardWidgetStatsGrid,
} from "@/components/dashboard/dashboard-stat-block";
import { DashboardWidgetShell } from "@/components/dashboard/dashboard-widget-shell";
import { useDashboardInventoryStats } from "@/lib/hooks/use-dashboard-inventory-stats";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";

export function DashboardInventoryTile() {
  const { summary, loading, error, ready } = useDashboardInventoryStats();
  const showSkeleton = useDeferredSkeleton(!ready || loading);

  const emptyStock = summary?.emptyStock ?? 0;
  const openOrders = summary?.openOrders ?? 0;

  return (
    <DashboardWidgetShell
      title="Bestand & Bestellung"
      icon={
        <Package className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      }
      href="/inventory/uebersicht"
      linkLabel="Zum Bestand"
      ready={ready}
      loading={showSkeleton}
      error={error}
    >
      <DashboardWidgetStatsGrid columns={2}>
        <DashboardStatBlock
          size="compact"
          label="Zutaten aktiv"
          primary={String(summary?.ingredientsActive ?? 0)}
          secondary="Erfasste Bestandspositionen"
        />
        <DashboardStatBlock
          size="compact"
          label="Leerer Bestand"
          primary={String(emptyStock)}
          secondary={
            emptyStock === 1
              ? "Zutat mit Bestand 0"
              : "Zutaten mit Bestand 0"
          }
          highlight={emptyStock > 0}
        />
        <DashboardStatBlock
          size="compact"
          label="Offene Bestellungen"
          primary={String(openOrders)}
          secondary={
            <>
              <ShoppingCart
                className="mr-1 inline size-3.5 align-[-0.15em] text-muted-foreground"
                aria-hidden
              />
              {summary?.openOrderLines ?? 0}{" "}
              {(summary?.openOrderLines ?? 0) === 1 ? "Position" : "Positionen"}
            </>
          }
          highlight={openOrders > 0}
        />
      </DashboardWidgetStatsGrid>
    </DashboardWidgetShell>
  );
}
