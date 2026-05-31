"use client";

import { useMemo } from "react";
import { SuperadminStatsKpiGrid } from "@/components/superadmin/superadmin-stats-kpi-grid";
import {
  SuperadminAreaChartCard,
  SuperadminBarChartCard,
} from "@/components/superadmin/superadmin-stats-charts";
import { computeUserStats } from "@/lib/superadmin/compute-user-stats";
import type { SuperadminUserRow } from "@/lib/supabase/platform-superadmin-db";

export function SuperadminUserStats({
  rows,
}: {
  rows: SuperadminUserRow[];
}) {
  const stats = useMemo(() => computeUserStats(rows), [rows]);

  const kpis = useMemo(
    () => [
      { label: "User gesamt", value: String(stats.kpis.total) },
      {
        label: "Neu (30 Tage)",
        value: String(stats.kpis.newLast30Days),
        hint: "Registrierungen",
      },
      {
        label: "Aktiv (30 Tage)",
        value: String(stats.kpis.activeLast30Days),
        hint: "Letzte Anmeldung",
      },
      {
        label: "Mit Restaurant",
        value: String(stats.kpis.withRestaurant),
        hint: "Mindestens ein aktives Mandat",
      },
      {
        label: "Nie angemeldet",
        value: String(stats.kpis.neverSignedIn),
      },
    ],
    [stats.kpis],
  );

  const registrationData = stats.registrationsByMonth.map((p) => ({
    label: p.label,
    count: p.count,
  }));

  const cumulativeData = stats.cumulativeUsers.map((p) => ({
    label: p.label,
    total: p.total,
  }));

  return (
    <div className="space-y-6">
      <SuperadminStatsKpiGrid items={kpis} />

      <div className="grid gap-6 lg:grid-cols-5">
        <SuperadminAreaChartCard
          className="lg:col-span-3"
          title="Neue Registrierungen"
          description="Anzahl neuer User-Konten pro Monat (letzte 12 Monate)."
          data={registrationData}
          dataKey="count"
          yLabel="Neue User"
        />
        <SuperadminAreaChartCard
          className="lg:col-span-2"
          title="User-Bestand"
          description="Kumulierte Anzahl aller registrierten User bis Monatsende."
          data={cumulativeData}
          dataKey="total"
          yLabel="User gesamt"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <SuperadminBarChartCard
          title="Sprachen"
          description="Verteilung der Profil-Sprache (Top 8)."
          data={stats.localeDistribution}
          horizontal
        />
        <SuperadminBarChartCard
          title="Letzte Anmeldung"
          description="Aktivität nach letztem Login (Stand heute)."
          data={stats.signInRecency}
        />
        <SuperadminBarChartCard
          title="Restaurants pro User"
          description="Wie viele Mandate User aktiv zugeordnet sind."
          data={stats.restaurantsPerUser}
        />
      </div>
    </div>
  );
}
