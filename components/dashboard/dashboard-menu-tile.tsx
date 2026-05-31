"use client";

import { useMemo } from "react";
import { UtensilsCrossed } from "lucide-react";
import {
  DashboardStatBlock,
  DashboardWidgetStatsGrid,
} from "@/components/dashboard/dashboard-stat-block";
import { DashboardWidgetShell } from "@/components/dashboard/dashboard-widget-shell";
import { computeDashboardMenuSummary } from "@/lib/menu/compute-dashboard-menu-summary";
import { useCategoriesStorage } from "@/lib/hooks/use-categories-storage";
import { useMenuStorage } from "@/lib/hooks/use-menu-storage";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";

export function DashboardMenuTile() {
  const { items, isHydrated: menuReady } = useMenuStorage();
  const { categories, isHydrated: catReady } = useCategoriesStorage();
  const ready = menuReady && catReady;
  const showSkeleton = useDeferredSkeleton(!ready);

  const summary = useMemo(
    () => (ready ? computeDashboardMenuSummary(items, categories) : null),
    [ready, items, categories],
  );

  return (
    <DashboardWidgetShell
      title="Speisekarte"
      description="Überblick über Gerichte, Kategorien und Preise."
      icon={
        <UtensilsCrossed
          className="size-5 shrink-0 text-muted-foreground"
          aria-hidden
        />
      }
      href="/menu/uebersicht"
      linkLabel="Zur Speisekarte"
      ready={ready}
      loading={showSkeleton}
      error={null}
    >
      {summary ? (
        <DashboardWidgetStatsGrid>
          <DashboardStatBlock
            label="Gerichte aktiv"
            primary={String(summary.dishesActive)}
            secondary={
              summary.dishesTotal !== summary.dishesActive
                ? `${summary.dishesTotal} gesamt (inkl. inaktiv)`
                : "Alle Gerichte aktiv"
            }
          />
          <DashboardStatBlock
            label="Kategorien"
            primary={String(summary.categoriesActive)}
            secondary={
              summary.topCategoryName && summary.topCategoryCount > 0
                ? `Meiste Gerichte: ${summary.topCategoryName} (${summary.topCategoryCount})`
                : "Noch keine Zuordnung"
            }
          />
          <DashboardStatBlock
            label="Ø Preis"
            primary={
              summary.avgPrice != null
                ? `${summary.avgPrice.toFixed(2)} €`
                : "—"
            }
            secondary={
              summary.withoutCategory > 0
                ? `${summary.withoutCategory} ohne gültige Kategorie`
                : "Aktive Gerichte mit Preis"
            }
            highlight={summary.withoutCategory > 0}
          />
        </DashboardWidgetStatsGrid>
      ) : null}
    </DashboardWidgetShell>
  );
}
