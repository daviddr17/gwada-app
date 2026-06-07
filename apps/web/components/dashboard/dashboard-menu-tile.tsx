"use client";

import { useMemo } from "react";
import { UtensilsCrossed } from "lucide-react";
import {
  DashboardCompactInlineMetrics,
  DashboardCompactMetricPill,
} from "@/components/dashboard/dashboard-compact-list";
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
      icon={
        <UtensilsCrossed
          className="size-4 shrink-0 text-muted-foreground"
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
              href="/menu/uebersicht"
              highlight
            />
          ) : null}
        </DashboardCompactInlineMetrics>
      ) : null}
    </DashboardWidgetShell>
  );
}
