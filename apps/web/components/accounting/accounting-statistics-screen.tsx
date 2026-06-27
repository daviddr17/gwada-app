"use client";


import { useEffect, useMemo, useState } from "react";
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
import { FileText, Landmark, Receipt, Wallet } from "lucide-react";
import { toast } from "sonner";
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
import { Button } from "@/components/ui/button";
import { Skeleton, SkeletonCardFrame } from "@/components/ui/skeleton";
import {
  computeAccountingStatistics,
  formatAccountingMoney,
  type AccountingStatsPeriod,
} from "@/lib/accounting/compute-accounting-statistics";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { fetchAccountingStatisticsBundle } from "@/lib/supabase/accounting-analytics-db";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { cn } from "@/lib/utils";

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

const sourceConfig = {
  count: { label: "Dokumente", color: "var(--accent)" },
} satisfies ChartConfig;

const cashMonthConfig = {
  income: { label: "Einnahmen", color: "var(--chart-2)" },
  expense: { label: "Ausgaben", color: "var(--chart-1)" },
} satisfies ChartConfig;

function ChartEmpty({ message }: { message: string }) {
  return (
    <p className="px-6 py-12 text-center text-sm text-muted-foreground">
      {message}
    </p>
  );
}

export function AccountingStatisticsScreen() {
  const { restaurantId, supabaseEnvOk, ready: workspaceReady } =
    useWorkspaceRestaurantUuid();
  const [period, setPeriod] = useState<AccountingStatsPeriod>(12);
  const [bundle, setBundle] = useState<Awaited<
    ReturnType<typeof fetchAccountingStatisticsBundle>
  >["data"]>(null);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDeferredSkeleton(loading);

  useEffect(() => {
    if (!restaurantId) return;
    let cancel = false;
    setLoading(true);
    void (async () => {
      const { data, error } = await fetchAccountingStatisticsBundle({
        restaurantId,
        monthsBack: period,
      });
      if (cancel) return;
      setLoading(false);
      if (error) toast.error(error);
      else setBundle(data);
    })();
    return () => {
      cancel = true;
    };
  }, [restaurantId, period]);

  const stats = useMemo(() => {
    if (!bundle) return null;
    return computeAccountingStatistics({
      invoices: bundle.invoices,
      quotations: bundle.quotations,
      vouchers: bundle.vouchers,
      cashEntries: bundle.cashEntries,
      periodStart: bundle.periodStart,
      periodEnd: bundle.periodEnd,
    });
  }, [bundle]);

  const sourceChartData = useMemo(
    () =>
      stats?.bySource.map((row) => ({
        name: row.label,
        count: row.count,
        fill: row.color,
      })) ?? [],
    [stats?.bySource],
  );

  const voucherKindChartData = useMemo(
    () =>
      stats?.byVoucherKind.map((row) => ({
        name: row.label,
        count: row.count,
        fill: row.fill,
      })) ?? [],
    [stats?.byVoucherKind],
  );

  if (!supabaseEnvOk) {
    return (
      <p className="text-sm text-muted-foreground">
        Supabase-Umgebungsvariablen fehlen.
      </p>
    );
  }

  if (!workspaceReady) {
    return <WorkspaceRestaurantResolvePlaceholder className="min-h-[20rem]" />;
  }

  if (!restaurantId) {
    return <WorkspaceRestaurantMissingMessage />;
  }

  return (
    <div className="space-y-6 px-4 pb-4 sm:px-6">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <div
          className="flex flex-wrap gap-1 rounded-xl border border-border/50 bg-muted/30 p-1"
          role="group"
          aria-label="Zeitraum"
        >
          {([3, 6, 12] as const).map((m) => (
            <Button
              key={m}
              type="button"
              size="sm"
              variant={period === m ? "default" : "ghost"}
              className={cn(
                "h-8 rounded-lg px-3 text-xs",
                period === m && "shadow-sm",
              )}
              onClick={() => setPeriod(m)}
            >
              {m} Mon.
            </Button>
          ))}
        </div>
      </div>

      {showSkeleton ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCardFrame key={i} className="min-h-[5.5rem] py-4">
              <Skeleton className="h-3 w-24 rounded-md" />
              <Skeleton className="mt-3 h-8 w-16 rounded-lg" />
            </SkeletonCardFrame>
          ))}
        </div>
      ) : stats ? (
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
              icon={Wallet}
              label="Kasse"
              value={String(stats.cashEntriesInPeriod)}
              hint="Buchungen im Zeitraum"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
            <KpiCard
              icon={Landmark}
              label="Rechnungsvolumen"
              value={formatAccountingMoney(stats.invoiceGrossInPeriod)}
              hint="Brutto im Zeitraum"
            />
            <KpiCard
              icon={Wallet}
              label="Einnahmen / Ausgaben"
              value={`${formatAccountingMoney(stats.cashIncomeInPeriod)} / ${formatAccountingMoney(stats.cashExpenseInPeriod)}`}
              hint="Kassenbuch im Zeitraum"
            />
            <KpiCard
              icon={Landmark}
              label="Gwada / Lexoffice"
              value={`${stats.gwadaDocumentsInPeriod} / ${stats.lexofficeDocumentsInPeriod}`}
              hint={
                stats.topVoucherKind
                  ? `Top Belegart: ${stats.topVoucherKind}`
                  : "Dokumente im Zeitraum"
              }
            />
          </div>
        </>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="min-w-0 border-border/50 shadow-card">
          <CardHeader>
            <CardTitle className="text-lg">Verlauf pro Monat</CardTitle>
            <CardDescription>
              Neue Rechnungen, Angebote und Belege im Zeitraum.
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            {showSkeleton ? (
              <Skeleton className="mx-6 h-[240px] w-auto rounded-xl" />
            ) : !stats || stats.byMonth.length === 0 ? (
              <ChartEmpty message="Noch keine Buchhaltungsdaten im gewählten Zeitraum." />
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
              Rechnungen, Angebote, Belege und Kasse im Zeitraum.
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            {showSkeleton ? (
              <Skeleton className="mx-6 h-[240px] w-auto rounded-xl" />
            ) : !stats || stats.byDocumentType.length === 0 ? (
              <ChartEmpty message="Noch keine Dokumente im gewählten Zeitraum." />
            ) : (
              <ChartContainer
                config={documentTypeConfig}
                className="aspect-auto h-[260px] w-full min-w-0"
              >
                <BarChart
                  accessibilityLayer
                  data={stats.byDocumentType}
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
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {stats.byDocumentType.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="min-w-0 border-border/50 shadow-card">
          <CardHeader>
            <CardTitle className="text-lg">Rechnungsstatus</CardTitle>
            <CardDescription>
              Statusverteilung der Rechnungen im Zeitraum.
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            {showSkeleton ? (
              <Skeleton className="mx-6 h-[240px] w-auto rounded-xl" />
            ) : !stats || stats.byInvoiceStatus.length === 0 ? (
              <ChartEmpty message="Noch keine Rechnungen im gewählten Zeitraum." />
            ) : (
              <ChartContainer
                config={invoiceStatusConfig}
                className="aspect-auto h-[260px] w-full min-w-0"
              >
                <BarChart
                  accessibilityLayer
                  data={stats.byInvoiceStatus}
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
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {stats.byInvoiceStatus.map((entry) => (
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
            <CardTitle className="text-lg">
              {voucherKindChartData.length > 0 ? "Belegarten" : "Quelle"}
            </CardTitle>
            <CardDescription>
              {voucherKindChartData.length > 0
                ? "Einnahmen, Ausgaben, Einkauf und Verkauf."
                : "Gwada und Lexoffice im Zeitraum."}
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            {showSkeleton ? (
              <Skeleton className="mx-6 h-[240px] w-auto rounded-xl" />
            ) : !stats ||
              (voucherKindChartData.length === 0 &&
                sourceChartData.length === 0) ? (
              <ChartEmpty message="Noch keine Belege im gewählten Zeitraum." />
            ) : (
              <ChartContainer
                config={
                  voucherKindChartData.length > 0
                    ? voucherKindConfig
                    : sourceConfig
                }
                className="aspect-auto h-[260px] w-full min-w-0"
              >
                <BarChart
                  accessibilityLayer
                  data={
                    voucherKindChartData.length > 0
                      ? voucherKindChartData
                      : sourceChartData
                  }
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
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {(voucherKindChartData.length > 0
                      ? voucherKindChartData
                      : sourceChartData
                    ).map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="min-w-0 border-border/50 shadow-card">
        <CardHeader>
          <CardTitle className="text-lg">Kasse pro Monat</CardTitle>
          <CardDescription>
            Einnahmen und Ausgaben nach Buchungsmonat.
          </CardDescription>
        </CardHeader>
        <CardContent className="pl-0">
          {showSkeleton ? (
            <Skeleton className="mx-6 h-[280px] w-auto rounded-xl" />
          ) : !stats ||
            stats.cashByMonth.every(
              (row) => row.income === 0 && row.expense === 0,
            ) ? (
            <ChartEmpty message="Noch keine Kassenbuchungen im Zeitraum." />
          ) : (
            <ChartContainer
              config={cashMonthConfig}
              className="aspect-auto h-[280px] w-full min-w-0"
            >
              <BarChart
                accessibilityLayer
                data={stats.cashByMonth}
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
                  width={48}
                  className="tabular-nums text-[10px]"
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) =>
                        formatAccountingMoney(Number(value))
                      }
                    />
                  }
                />
                <Bar
                  dataKey="income"
                  fill="var(--color-income)"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="expense"
                  fill="var(--color-expense)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
