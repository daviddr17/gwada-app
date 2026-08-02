"use client";

import { useMemo } from "react";
import { SuperadminStatsKpiGrid } from "@/components/superadmin/superadmin-stats-kpi-grid";
import {
  SuperadminAreaChartCard,
  SuperadminBarChartCard,
} from "@/components/superadmin/superadmin-stats-charts";
import {
  computeSubscriptionStats,
  formatStatsEur,
} from "@/lib/superadmin/compute-subscription-stats";
import type {
  SuperadminBillingInvoiceRow,
  SuperadminSubscriptionRow,
} from "@/lib/supabase/platform-superadmin-db";

export function SuperadminSubscriptionStats({
  subscriptions,
  invoices,
}: {
  subscriptions: SuperadminSubscriptionRow[];
  invoices: SuperadminBillingInvoiceRow[];
}) {
  const stats = useMemo(
    () => computeSubscriptionStats(subscriptions, invoices),
    [subscriptions, invoices],
  );

  const kpis = useMemo(
    () => [
      {
        label: "MRR (Stripe)",
        value: formatStatsEur(stats.kpis.mrrEur),
        hint: "Katalogpreise × zahlende Stripe-Abos",
      },
      {
        label: "ARR (Stripe)",
        value: formatStatsEur(stats.kpis.arrEur),
      },
      {
        label: "Einnahmen 30 Tage",
        value: formatStatsEur(stats.kpis.paidLast30DaysEur),
        hint: "Bezahlt laut syncten Rechnungen",
      },
      {
        label: "Einnahmen gesamt",
        value: formatStatsEur(stats.kpis.paidAllTimeEur),
      },
      {
        label: "Zahlende Abos",
        value: String(stats.kpis.payingCount),
        hint: `${stats.kpis.posCount} mit POS · ${stats.kpis.legacyCount} Legacy`,
      },
      {
        label: "Free",
        value: String(stats.kpis.freeCount),
      },
      {
        label: "Complimentary",
        value: String(stats.kpis.complimentaryCount),
      },
      {
        label: "Fehlgeschlagene Zahlungen",
        value: String(stats.kpis.failedCount),
      },
    ],
    [stats.kpis],
  );

  return (
    <div className="space-y-6">
      <SuperadminStatsKpiGrid
        className="2xl:grid-cols-4"
        items={kpis}
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <SuperadminAreaChartCard
          className="lg:col-span-3"
          title="Zahlungseingänge"
          description="Bezahlt (EUR) pro Monat aus syncten Stripe-Rechnungen."
          data={stats.revenueByMonth.map((p) => ({
            label: p.label,
            eur: p.eur,
          }))}
          dataKey="eur"
          yLabel="EUR"
        />
        <SuperadminAreaChartCard
          className="lg:col-span-2"
          title="Neue Paid-Abos"
          description="Basic/Pro (Stripe/Complimentary) nach Anlagedatum."
          data={stats.newPayingByMonth.map((p) => ({
            label: p.label,
            count: p.count,
          }))}
          dataKey="count"
          yLabel="Abos"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <SuperadminBarChartCard
          title="Pläne"
          description="Verteilung Free / Basic / Pro."
          data={stats.planDistribution}
        />
        <SuperadminBarChartCard
          title="Quelle"
          description="Stripe, Legacy, Manuell, Complimentary."
          data={stats.sourceDistribution}
        />
        <SuperadminBarChartCard
          title="Status"
          description="Aktueller Abo-Status aller Restaurants."
          data={stats.statusDistribution}
        />
      </div>
    </div>
  );
}
