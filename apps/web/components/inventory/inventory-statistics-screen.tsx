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
import {
  AlertTriangle,
  Package,
  ShoppingCart,
  Truck,
} from "lucide-react";
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
  computeInventoryStatistics,
  type InventoryStatsPeriod,
} from "@/lib/inventory/compute-inventory-statistics";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { fetchInventoryStatisticsBundle } from "@/lib/supabase/inventory-analytics-db";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { cn } from "@/lib/utils";

const monthConfig = {
  count: { label: "Bestellungen", color: "var(--accent)" },
} satisfies ChartConfig;

const weekdayConfig = {
  count: { label: "Bestellungen", color: "var(--chart-2)" },
} satisfies ChartConfig;

const categoryConfig = {
  count: { label: "Zutaten", color: "var(--chart-1)" },
} satisfies ChartConfig;

const supplierConfig = {
  count: { label: "Zutaten", color: "var(--chart-3)" },
} satisfies ChartConfig;

const movementConfig = {
  count: { label: "Bewegungen", color: "var(--chart-4)" },
} satisfies ChartConfig;

const orderSupplierConfig = {
  count: { label: "Bestellungen", color: "var(--chart-5)" },
} satisfies ChartConfig;

const statusConfig = {
  count: { label: "Bestellungen", color: "var(--chart-3)" },
} satisfies ChartConfig;

function ChartEmpty({ message }: { message: string }) {
  return (
    <p className="px-6 py-12 text-center text-sm text-muted-foreground">
      {message}
    </p>
  );
}

export function InventoryStatisticsScreen() {
  const { restaurantId, supabaseEnvOk, ready: workspaceReady } =
    useWorkspaceRestaurantUuid();
  const [period, setPeriod] = useState<InventoryStatsPeriod>(12);
  const [bundle, setBundle] = useState<Awaited<
    ReturnType<typeof fetchInventoryStatisticsBundle>
  >["data"]>(null);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDeferredSkeleton(loading);

  useEffect(() => {
    if (!restaurantId) return;
    let cancel = false;
    setLoading(true);
    void (async () => {
      const { data, error } = await fetchInventoryStatisticsBundle({
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
    return computeInventoryStatistics({
      ingredients: bundle.ingredients,
      orders: bundle.orders,
      categoryNames: bundle.categoryNames,
      supplierNames: bundle.supplierNames,
      periodStart: bundle.periodStart,
      periodEnd: bundle.periodEnd,
    });
  }, [bundle]);

  const movementChartData = useMemo(
    () =>
      stats?.byMovementKind.map((row) => ({
        name: row.label,
        count: row.count,
        fill: row.fill,
      })) ?? [],
    [stats?.byMovementKind],
  );

  const statusChartData = useMemo(
    () =>
      stats?.orderStatusInPeriod.map((row) => ({
        name: row.name,
        count: row.count,
        fill: row.fill,
      })) ?? [],
    [stats?.orderStatusInPeriod],
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
              icon={Package}
              label="Aktive Zutaten"
              value={String(stats.activeIngredients)}
              hint={
                stats.topCategory
                  ? `Meiste in „${stats.topCategory}“`
                  : "Im Bestand"
              }
            />
            <KpiCard
              icon={AlertTriangle}
              label="Leer / Niedrig"
              value={`${stats.emptyStockCount} / ${stats.lowStockCount}`}
              hint="Leerer Bestand / unter Schwellwert"
            />
            <KpiCard
              icon={ShoppingCart}
              label="Offene Bestellungen"
              value={String(stats.openOrders)}
              hint={`${stats.openOrderLines} Positionen`}
            />
            <KpiCard
              icon={ShoppingCart}
              label="Bestellungen"
              value={String(stats.ordersInPeriod)}
              hint={`${stats.closedOrdersInPeriod} abgeschlossen`}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              icon={ShoppingCart}
              label="Bestellpositionen"
              value={String(stats.orderLinesInPeriod)}
              hint="Im gewählten Zeitraum"
            />
            <KpiCard
              icon={Truck}
              label="Lieferungen gebucht"
              value={String(stats.deliveriesInPeriod)}
              hint={`${stats.stockMovementsInPeriod} Bestandsbewegungen`}
            />
            <KpiCard
              icon={Package}
              label="Rechnungsabzüge"
              value={String(stats.invoiceMovementsInPeriod)}
              hint="Aus Rechnungen / Korrekturen"
            />
            <KpiCard
              icon={ShoppingCart}
              label="Top-Lieferant"
              value={stats.topOrderSupplier ?? "—"}
              hint="Meiste Bestellungen im Zeitraum"
            />
          </div>
        </>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="min-w-0 border-border/50 shadow-card">
          <CardHeader>
            <CardTitle className="text-lg">Bestellungen pro Monat</CardTitle>
            <CardDescription>
              Neu angelegte Bestellungen im Zeitraum.
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            {showSkeleton ? (
              <Skeleton className="mx-6 h-[240px] w-auto rounded-xl" />
            ) : !stats || stats.ordersByMonth.length === 0 ? (
              <ChartEmpty message="Noch keine Bestellungen im gewählten Zeitraum." />
            ) : (
              <ChartContainer
                config={monthConfig}
                className="aspect-auto h-[260px] w-full min-w-0"
              >
                <LineChart
                  accessibilityLayer
                  data={stats.ordersByMonth}
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
            <CardTitle className="text-lg">Bestandsbewegungen</CardTitle>
            <CardDescription>
              Manuelle Änderungen, Lieferungen und Rechnungen im Zeitraum.
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            {showSkeleton ? (
              <Skeleton className="mx-6 h-[240px] w-auto rounded-xl" />
            ) : !stats || movementChartData.length === 0 ? (
              <ChartEmpty message="Noch keine Bestandsbewegungen im Zeitraum." />
            ) : (
              <ChartContainer
                config={movementConfig}
                className="aspect-auto h-[260px] w-full min-w-0"
              >
                <BarChart
                  accessibilityLayer
                  data={movementChartData}
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
                    {movementChartData.map((entry) => (
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
            <CardTitle className="text-lg">Zutaten nach Kategorie</CardTitle>
            <CardDescription>Aktive Zutaten im Bestand.</CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            {showSkeleton ? (
              <Skeleton className="mx-6 h-[240px] w-auto rounded-xl" />
            ) : !stats || stats.byCategory.length === 0 ? (
              <ChartEmpty message="Noch keine Zutaten angelegt." />
            ) : (
              <ChartContainer
                config={categoryConfig}
                className="aspect-auto h-[260px] w-full min-w-0"
              >
                <BarChart
                  accessibilityLayer
                  data={stats.byCategory}
                  layout="vertical"
                  margin={{ left: 8, right: 8, top: 8, bottom: 0 }}
                >
                  <CartesianGrid horizontal={false} strokeDasharray="4 4" />
                  <XAxis
                    type="number"
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    width={112}
                    className="text-xs"
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar
                    dataKey="count"
                    fill="var(--color-count)"
                    radius={[0, 6, 6, 0]}
                  />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0 border-border/50 shadow-card">
          <CardHeader>
            <CardTitle className="text-lg">Zutaten nach Lieferant</CardTitle>
            <CardDescription>
              Verteilung der aktiven Zutaten.
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            {showSkeleton ? (
              <Skeleton className="mx-6 h-[240px] w-auto rounded-xl" />
            ) : !stats || stats.bySupplier.length === 0 ? (
              <ChartEmpty message="Noch keine Zutaten angelegt." />
            ) : (
              <ChartContainer
                config={supplierConfig}
                className="aspect-auto h-[260px] w-full min-w-0"
              >
                <BarChart
                  accessibilityLayer
                  data={stats.bySupplier}
                  layout="vertical"
                  margin={{ left: 8, right: 8, top: 8, bottom: 0 }}
                >
                  <CartesianGrid horizontal={false} strokeDasharray="4 4" />
                  <XAxis
                    type="number"
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    width={112}
                    className="text-xs"
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar
                    dataKey="count"
                    fill="var(--color-count)"
                    radius={[0, 6, 6, 0]}
                  />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="min-w-0 border-border/50 shadow-card">
          <CardHeader>
            <CardTitle className="text-lg">Bestellungen nach Lieferant</CardTitle>
            <CardDescription>Im gewählten Zeitraum.</CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            {showSkeleton ? (
              <Skeleton className="mx-6 h-[240px] w-auto rounded-xl" />
            ) : !stats || stats.byOrderSupplier.length === 0 ? (
              <ChartEmpty message="Noch keine Bestellungen im Zeitraum." />
            ) : (
              <ChartContainer
                config={orderSupplierConfig}
                className="aspect-auto h-[260px] w-full min-w-0"
              >
                <BarChart
                  accessibilityLayer
                  data={stats.byOrderSupplier}
                  margin={{ left: 4, right: 8, top: 8, bottom: 0 }}
                >
                  <CartesianGrid vertical={false} strokeDasharray="4 4" />
                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    interval={0}
                    className="text-[10px]"
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={32}
                    allowDecimals={false}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar
                    dataKey="count"
                    fill="var(--color-count)"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0 border-border/50 shadow-card">
          <CardHeader>
            <CardTitle className="text-lg">Bestellstatus im Zeitraum</CardTitle>
            <CardDescription>
              Offen vs. abgeschlossen (nach Anlegedatum).
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            {showSkeleton ? (
              <Skeleton className="mx-6 h-[240px] w-auto rounded-xl" />
            ) : !stats || statusChartData.length === 0 ? (
              <ChartEmpty message="Noch keine Bestellungen im Zeitraum." />
            ) : (
              <ChartContainer
                config={statusConfig}
                className="aspect-auto h-[260px] w-full min-w-0"
              >
                <BarChart
                  accessibilityLayer
                  data={statusChartData}
                  margin={{ left: 4, right: 8, top: 8, bottom: 0 }}
                >
                  <CartesianGrid vertical={false} strokeDasharray="4 4" />
                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={12}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={32}
                    allowDecimals={false}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {statusChartData.map((entry) => (
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
          <CardTitle className="text-lg">Bestellungen nach Wochentag</CardTitle>
          <CardDescription>
            Wann Bestellungen im Zeitraum angelegt wurden.
          </CardDescription>
        </CardHeader>
        <CardContent className="pl-0">
          {showSkeleton ? (
            <Skeleton className="mx-6 h-[240px] w-auto rounded-xl" />
          ) : !stats || stats.ordersInPeriod === 0 ? (
            <ChartEmpty message="Noch keine Bestellungen im gewählten Zeitraum." />
          ) : (
            <ChartContainer
              config={weekdayConfig}
              className="aspect-auto h-[260px] w-full min-w-0"
            >
              <BarChart
                accessibilityLayer
                data={stats.ordersByWeekday}
                margin={{ left: 4, right: 8, top: 8, bottom: 0 }}
              >
                <CartesianGrid vertical={false} strokeDasharray="4 4" />
                <XAxis
                  dataKey="day"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={12}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={32}
                  allowDecimals={false}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="count"
                  fill="var(--color-count)"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
