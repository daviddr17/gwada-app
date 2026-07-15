"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import { FileText, Landmark, Receipt } from "lucide-react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  formatAccountingMoney,
  type AccountingStatisticsResult,
} from "@/lib/accounting/compute-accounting-statistics";
import type { LexofficeInsightsSnapshot } from "@/lib/insights/compute-insights-statistics";

const monthConfig = {
  count: { label: "Dokumente", color: "var(--accent)" },
} satisfies ChartConfig;

const documentTypeConfig = {
  count: { label: "Anzahl", color: "var(--chart-1)" },
} satisfies ChartConfig;

const invoiceStatusConfig = {
  count: { label: "Rechnungen", color: "var(--chart-5)" },
} satisfies ChartConfig;

const voucherKindConfig = {
  count: { label: "Belege", color: "var(--chart-3)" },
} satisfies ChartConfig;

function ChartEmpty({ message }: { message: string }) {
  return (
    <p className="px-6 py-12 text-center text-sm text-muted-foreground">
      {message}
    </p>
  );
}

function hasLexofficeDocuments(stats: AccountingStatisticsResult): boolean {
  return (
    stats.invoicesInPeriod +
      stats.quotationsInPeriod +
      stats.vouchersInPeriod +
      stats.openInvoices >
    0
  );
}

export function LexofficeInsightsPanels({
  lexoffice,
}: {
  lexoffice: LexofficeInsightsSnapshot;
}) {
  const stats = lexoffice.stats;

  if (!lexoffice.connected && (!stats || !hasLexofficeDocuments(stats))) {
    return (
      <Card className="border-border/50 shadow-card">
        <CardContent className="flex flex-col items-start gap-3 py-8">
          <p className="text-sm text-muted-foreground">
            Lexoffice ist nicht verbunden. Verbinde Lexoffice unter Einstellungen
            → Integrationen, um synchronisierte Rechnungen und Belege hier zu
            sehen.
          </p>
          <Link
            href="/dashboard/settings/integrationen"
            className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-3 text-sm font-medium hover:bg-muted"
          >
            Zu Integrationen
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (!stats || !hasLexofficeDocuments(stats)) {
    return (
      <Card className="border-border/50 shadow-card">
        <CardContent className="py-8">
          <p className="text-sm text-muted-foreground">
            {lexoffice.connected
              ? "Noch keine Lexoffice-Dokumente im gewählten Zeitraum. Nach dem Sync erscheinen Rechnungen, Angebote und Belege hier."
              : "Keine Lexoffice-Daten im gewählten Zeitraum."}
          </p>
        </CardContent>
      </Card>
    );
  }

  const documentTypeChartData = stats.byDocumentType.map((row) => ({
    name: row.name,
    count: row.count,
    fill: row.fill,
  }));

  const invoiceStatusChartData = stats.byInvoiceStatus.map((row) => ({
    name: row.name,
    count: row.count,
    fill: row.fill,
  }));

  const voucherKindChartData = stats.byVoucherKind.map((row) => ({
    name: row.label,
    count: row.count,
    fill: row.fill,
  }));

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={FileText}
          label="Rechnungen"
          value={String(stats.invoicesInPeriod)}
          hint={`${stats.paidInvoicesInPeriod} bezahlt im Zeitraum`}
        />
        <KpiCard
          icon={FileText}
          label="Angebote"
          value={String(stats.quotationsInPeriod)}
          hint="Im gewählten Zeitraum"
        />
        <KpiCard
          icon={Receipt}
          label="Belege"
          value={String(stats.vouchersInPeriod)}
          hint={
            stats.voucherGrossInPeriod > 0
              ? formatAccountingMoney(stats.voucherGrossInPeriod)
              : "Im gewählten Zeitraum"
          }
        />
        <KpiCard
          icon={FileText}
          label="Offene Rechnungen"
          value={String(stats.openInvoices)}
          hint={
            stats.topInvoiceStatus
              ? `Häufigster Status: ${stats.topInvoiceStatus}`
              : "Aktuell offen oder überfällig"
          }
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <KpiCard
          icon={Landmark}
          label="Rechnungsvolumen"
          value={formatAccountingMoney(stats.invoiceGrossInPeriod)}
          hint="Brutto im Zeitraum"
        />
        <KpiCard
          icon={Receipt}
          label="Belegvolumen"
          value={formatAccountingMoney(stats.voucherGrossInPeriod)}
          hint={
            stats.topVoucherKind
              ? `Top Belegart: ${stats.topVoucherKind}`
              : "Brutto im Zeitraum"
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="min-w-0 border-border/50 shadow-card">
          <CardHeader>
            <CardTitle className="text-lg">Verlauf pro Monat</CardTitle>
            <CardDescription>
              Neue Lexoffice-Dokumente im Zeitraum.
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            {stats.byMonth.length === 0 ? (
              <ChartEmpty message="Noch keine Lexoffice-Daten im gewählten Zeitraum." />
            ) : (
              <ChartContainer
                config={monthConfig}
                className="aspect-auto h-[260px] w-full min-w-0"
              >
                <LineChart
                  accessibilityLayer
                  data={stats.byMonth}
                  margin={{ left: 4, right: 8, top: 8, bottom: 0 }}
                >
                  <CartesianGrid vertical={false} strokeDasharray="4 4" />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    className="text-[10px]"
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={32}
                    allowDecimals={false}
                    className="tabular-nums"
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="var(--color-count)"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "var(--color-count)" }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0 border-border/50 shadow-card">
          <CardHeader>
            <CardTitle className="text-lg">Nach Dokumenttyp</CardTitle>
            <CardDescription>
              Rechnungen, Angebote und Belege aus Lexoffice.
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            {documentTypeChartData.length === 0 ? (
              <ChartEmpty message="Keine Dokumente im Zeitraum." />
            ) : (
              <ChartContainer
                config={documentTypeConfig}
                className="aspect-auto h-[260px] w-full min-w-0"
              >
                <BarChart
                  accessibilityLayer
                  data={documentTypeChartData}
                  layout="vertical"
                  margin={{ left: 4, right: 8, top: 8, bottom: 0 }}
                >
                  <CartesianGrid horizontal={false} strokeDasharray="4 4" />
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    width={88}
                    className="text-[10px]"
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {documentTypeChartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0 border-border/50 shadow-card">
          <CardHeader>
            <CardTitle className="text-lg">Rechnungsstatus</CardTitle>
            <CardDescription>Verteilung im Zeitraum.</CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            {invoiceStatusChartData.length === 0 ? (
              <ChartEmpty message="Keine Rechnungen im Zeitraum." />
            ) : (
              <ChartContainer
                config={invoiceStatusConfig}
                className="aspect-auto h-[260px] w-full min-w-0"
              >
                <BarChart
                  accessibilityLayer
                  data={invoiceStatusChartData}
                  margin={{ left: 4, right: 8, top: 8, bottom: 0 }}
                >
                  <CartesianGrid vertical={false} strokeDasharray="4 4" />
                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    className="text-[10px]"
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={32}
                    allowDecimals={false}
                    className="tabular-nums"
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {invoiceStatusChartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0 border-border/50 shadow-card">
          <CardHeader>
            <CardTitle className="text-lg">Belegarten</CardTitle>
            <CardDescription>Ausgaben, Einnahmen, Einkauf, Verkauf.</CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            {voucherKindChartData.length === 0 ? (
              <ChartEmpty message="Keine Belege im Zeitraum." />
            ) : (
              <ChartContainer
                config={voucherKindConfig}
                className="aspect-auto h-[260px] w-full min-w-0"
              >
                <BarChart
                  accessibilityLayer
                  data={voucherKindChartData}
                  margin={{ left: 4, right: 8, top: 8, bottom: 0 }}
                >
                  <CartesianGrid vertical={false} strokeDasharray="4 4" />
                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    className="text-[10px]"
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={32}
                    allowDecimals={false}
                    className="tabular-nums"
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {voucherKindChartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
