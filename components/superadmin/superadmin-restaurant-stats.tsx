"use client";

import { useMemo } from "react";
import { SuperadminStatsKpiGrid } from "@/components/superadmin/superadmin-stats-kpi-grid";
import {
  SuperadminAreaChartCard,
  SuperadminBarChartCard,
} from "@/components/superadmin/superadmin-stats-charts";
import { computeRestaurantStats } from "@/lib/superadmin/compute-restaurant-stats";
import type { SuperadminRestaurantRow } from "@/lib/supabase/platform-superadmin-db";

export function SuperadminRestaurantStats({
  rows,
}: {
  rows: SuperadminRestaurantRow[];
}) {
  const stats = useMemo(() => computeRestaurantStats(rows), [rows]);

  const kpis = useMemo(
    () => [
      { label: "Restaurants gesamt", value: String(stats.kpis.total) },
      {
        label: "Veröffentlicht",
        value: String(stats.kpis.published),
      },
      { label: "Entwurf", value: String(stats.kpis.draft) },
      {
        label: "Neu (30 Tage)",
        value: String(stats.kpis.newLast30Days),
      },
      {
        label: "Ø Mitarbeitende",
        value: stats.kpis.avgEmployees.toLocaleString("de-DE", {
          maximumFractionDigits: 1,
        }),
        hint: "Aktive Zuordnungen pro Restaurant",
      },
    ],
    [stats.kpis],
  );

  return (
    <div className="space-y-6">
      <SuperadminStatsKpiGrid items={kpis} />

      <div className="grid gap-6 lg:grid-cols-5">
        <SuperadminAreaChartCard
          className="lg:col-span-3"
          title="Neue Restaurants"
          description="Angelegte Mandate pro Monat (letzte 12 Monate)."
          data={stats.createdByMonth.map((p) => ({
            label: p.label,
            count: p.count,
          }))}
          dataKey="count"
          yLabel="Neue Restaurants"
        />
        <SuperadminAreaChartCard
          className="lg:col-span-2"
          title="Restaurant-Bestand"
          description="Kumulierte Anzahl aller Restaurants bis Monatsende."
          data={stats.cumulativeRestaurants.map((p) => ({
            label: p.label,
            total: p.total,
          }))}
          dataKey="total"
          yLabel="Restaurants gesamt"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <SuperadminBarChartCard
          title="Veröffentlichungsstatus"
          description="Aktueller Stand aller Mandate."
          data={stats.publishedVsDraft}
        />
        <SuperadminBarChartCard
          title="Teamgröße"
          description="Aktive Mitarbeitende pro Restaurant."
          data={stats.employeesPerRestaurant}
        />
        <SuperadminBarChartCard
          title="Zeitzonen"
          description="Häufigste Zeitzonen-Einstellungen (Top 8)."
          data={stats.timezoneDistribution}
          horizontal
        />
      </div>
    </div>
  );
}
