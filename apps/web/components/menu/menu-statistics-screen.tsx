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
  ChefHat,
  FolderOpen,
  ImageIcon,
  UtensilsCrossed,
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
  computeMenuStatistics,
  formatMenuPrice,
  type MenuStatsPeriod,
} from "@/lib/menu/compute-menu-statistics";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { fetchMenuStatisticsBundle } from "@/lib/supabase/menu-analytics-db";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { cn } from "@/lib/utils";

const monthConfig = {
  count: { label: "Gerichte", color: "var(--accent)" },
} satisfies ChartConfig;

const categoryConfig = {
  count: { label: "Gerichte", color: "var(--chart-1)" },
} satisfies ChartConfig;

const priceBandConfig = {
  count: { label: "Gerichte", color: "var(--chart-2)" },
} satisfies ChartConfig;

const activeConfig = {
  count: { label: "Gerichte", color: "var(--chart-3)" },
} satisfies ChartConfig;

function ChartEmpty({ message }: { message: string }) {
  return (
    <p className="px-6 py-12 text-center text-sm text-muted-foreground">
      {message}
    </p>
  );
}

export function MenuStatisticsScreen() {
  const { restaurantId, supabaseEnvOk, ready: workspaceReady } =
    useWorkspaceRestaurantUuid();
  const [period, setPeriod] = useState<MenuStatsPeriod>(12);
  const [bundle, setBundle] = useState<Awaited<
    ReturnType<typeof fetchMenuStatisticsBundle>
  >["data"]>(null);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDeferredSkeleton(loading);

  useEffect(() => {
    if (!restaurantId) return;
    let cancel = false;
    setLoading(true);
    void (async () => {
      const { data, error } = await fetchMenuStatisticsBundle({
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
    return computeMenuStatistics({
      items: bundle.items,
      categoryNames: bundle.categoryNames,
      periodStart: bundle.periodStart,
      periodEnd: bundle.periodEnd,
    });
  }, [bundle]);

  const priceBandChartData = useMemo(
    () =>
      stats?.byPriceBand.map((row) => ({
        name: row.name,
        count: row.count,
        fill: row.fill,
      })) ?? [],
    [stats?.byPriceBand],
  );

  const activeChartData = useMemo(
    () =>
      stats?.activeVsInactive.map((row) => ({
        name: row.name,
        count: row.count,
        fill: row.fill,
      })) ?? [],
    [stats?.activeVsInactive],
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
              icon={UtensilsCrossed}
              label="Aktiv / Gesamt"
              value={`${stats.dishesActive} / ${stats.dishesTotal}`}
              hint={`${stats.newDishesInPeriod} neu im Zeitraum`}
            />
            <KpiCard
              icon={FolderOpen}
              label="Kategorien"
              value={String(stats.categoriesUsed)}
              hint={
                stats.withoutCategoryCount > 0
                  ? `${stats.withoutCategoryCount} ohne Kategorie`
                  : "Aktive Kategorien genutzt"
              }
            />
            <KpiCard
              icon={UtensilsCrossed}
              label="Ø Preis"
              value={
                stats.avgPrice != null ? formatMenuPrice(stats.avgPrice) : "—"
              }
              hint="Aktive Gerichte mit Preis"
            />
            <KpiCard
              icon={UtensilsCrossed}
              label="Min / Max Preis"
              value={
                stats.minPrice != null && stats.maxPrice != null
                  ? `${formatMenuPrice(stats.minPrice)} – ${formatMenuPrice(stats.maxPrice)}`
                  : "—"
              }
              hint="Aktive Gerichte"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              icon={ChefHat}
              label="Mit Rezept"
              value={String(stats.withRecipeCount)}
              hint="Aktive Gerichte mit Zutaten"
            />
            <KpiCard
              icon={ImageIcon}
              label="Mit Bild"
              value={String(stats.withImageCount)}
              hint={`${stats.withTagsCount} mit Tags`}
            />
            <KpiCard
              icon={FolderOpen}
              label="Beliebteste Kategorie"
              value={stats.topCategory ?? "—"}
              hint={
                stats.topCategoryCount > 0
                  ? `${stats.topCategoryCount} Gerichte`
                  : "Nach aktiven Gerichten"
              }
            />
            <KpiCard
              icon={UtensilsCrossed}
              label="Neu im Zeitraum"
              value={String(stats.newDishesInPeriod)}
              hint="Angelegte Gerichte"
            />
          </div>
        </>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="min-w-0 border-border/50 shadow-card">
          <CardHeader>
            <CardTitle className="text-lg">Verlauf pro Monat</CardTitle>
            <CardDescription>
              Neu angelegte Gerichte im gewählten Zeitraum.
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            {showSkeleton ? (
              <Skeleton className="mx-6 h-[240px] w-auto rounded-xl" />
            ) : !stats || stats.byMonth.length === 0 ? (
              <ChartEmpty message="Noch keine neuen Gerichte im Zeitraum." />
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
            <CardTitle className="text-lg">Aktiv vs. Inaktiv</CardTitle>
            <CardDescription>
              Sichtbare und deaktivierte Gerichte.
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            {showSkeleton ? (
              <Skeleton className="mx-6 h-[240px] w-auto rounded-xl" />
            ) : !stats || activeChartData.length === 0 ? (
              <ChartEmpty message="Noch keine Gerichte angelegt." />
            ) : (
              <ChartContainer
                config={activeConfig}
                className="aspect-auto h-[260px] w-full min-w-0"
              >
                <BarChart
                  accessibilityLayer
                  data={activeChartData}
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
                    {activeChartData.map((entry) => (
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
            <CardTitle className="text-lg">Top Kategorien</CardTitle>
            <CardDescription>
              Aktive Gerichte je Kategorie.
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            {showSkeleton ? (
              <Skeleton className="mx-6 h-[280px] w-auto rounded-xl" />
            ) : !stats || stats.byCategory.length === 0 ? (
              <ChartEmpty message="Noch keine kategorisierten Gerichte." />
            ) : (
              <ChartContainer
                config={categoryConfig}
                className="aspect-auto h-[280px] w-full min-w-0"
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
                    width={120}
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
            <CardTitle className="text-lg">Preisbänder</CardTitle>
            <CardDescription>
              Verteilung der Preise aktiver Gerichte.
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            {showSkeleton ? (
              <Skeleton className="mx-6 h-[280px] w-auto rounded-xl" />
            ) : !stats || priceBandChartData.length === 0 ? (
              <ChartEmpty message="Noch keine Gerichte mit Preisangabe." />
            ) : (
              <ChartContainer
                config={priceBandConfig}
                className="aspect-auto h-[280px] w-full min-w-0"
              >
                <BarChart
                  accessibilityLayer
                  data={priceBandChartData}
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
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {priceBandChartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
