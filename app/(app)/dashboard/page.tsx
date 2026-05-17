"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import { Skeleton, SkeletonCardFrame } from "@/components/ui/skeleton";
import { DashboardWeatherTile } from "@/components/dashboard/dashboard-weather-tile";
import { groupDashboardLayoutSections } from "@/lib/dashboard/group-dashboard-layout-sections";
import { useCategoriesStorage } from "@/lib/hooks/use-categories-storage";
import { useDashboardWidgetPreferences } from "@/lib/hooks/use-dashboard-widget-preferences";
import { useMenuStorage } from "@/lib/hooks/use-menu-storage";
import { cn } from "@/lib/utils";

const trendConfig = {
  views: {
    label: "Aufrufe",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

const categoryConfig = {
  count: {
    label: "Gerichte",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

const demoTrend = [
  { day: "Mo", views: 124 },
  { day: "Di", views: 198 },
  { day: "Mi", views: 156 },
  { day: "Do", views: 242 },
  { day: "Fr", views: 289 },
  { day: "Sa", views: 312 },
  { day: "So", views: 267 },
];

export default function DashboardPage() {
  const { items, isHydrated: menuReady } = useMenuStorage();
  const { categories, isHydrated: catReady } = useCategoriesStorage();
  const { visibility, order, isReady: widgetsReady } =
    useDashboardWidgetPreferences();

  const ready = menuReady && catReady && widgetsReady;

  const stats = useMemo(() => {
    const n = items.length;
    const total = items.reduce((s, i) => s + i.price, 0);
    const avg = n ? total / n : 0;
    return {
      dishes: n,
      categories: categories.length,
      avgPrice: avg,
    };
  }, [items, categories]);

  const byCategory = useMemo(
    () =>
      categories.map((c) => ({
        name: c.name,
        count: items.filter((i) => i.category === c.id).length,
      })),
    [categories, items],
  );

  const orderedVisible = useMemo(
    () => order.filter((id) => visibility[id]),
    [order, visibility],
  );

  const sections = useMemo(
    () => groupDashboardLayoutSections(orderedVisible),
    [orderedVisible],
  );

  const anyWidget = orderedVisible.length > 0;

  if (!ready) {
    return (
      <div className="space-y-8 pt-2">
        <Skeleton className="h-10 w-56 rounded-lg" />
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCardFrame key={i} className="min-h-[5.5rem] space-y-3 py-3">
              <Skeleton className="h-3 w-24 rounded-md" />
              <Skeleton className="h-9 w-20 rounded-lg" />
            </SkeletonCardFrame>
          ))}
        </div>
        <div className="grid gap-6 xl:grid-cols-12">
          <SkeletonCardFrame className="min-h-[16rem] space-y-5 xl:col-span-4">
            <div className="space-y-2">
              <Skeleton className="h-6 w-28 rounded-md" />
              <Skeleton className="h-4 w-64 max-w-full rounded-md" />
            </div>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex gap-3">
                <Skeleton className="size-12 shrink-0 rounded-xl" />
                <div className="space-y-2">
                  <Skeleton className="h-10 w-28 rounded-lg" />
                  <Skeleton className="h-4 w-44 rounded-md" />
                </div>
              </div>
              <div className="space-y-2">
                <Skeleton className="ml-auto h-4 w-32 rounded-md" />
                <Skeleton className="ml-auto h-4 w-24 rounded-md" />
                <Skeleton className="ml-auto h-4 w-24 rounded-md" />
              </div>
            </div>
            <div className="divide-y divide-border/50">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-4 py-2.5 first:pt-0"
                >
                  <Skeleton className="h-4 w-28 rounded-md" />
                  <Skeleton className="h-4 w-40 rounded-md" />
                </div>
              ))}
            </div>
          </SkeletonCardFrame>
          <div className="grid min-w-0 gap-6 lg:grid-cols-5 xl:col-span-8">
            <SkeletonCardFrame className="min-h-[18rem] space-y-4 lg:col-span-3">
              <div className="space-y-2">
                <Skeleton className="h-5 w-36 rounded-md" />
                <Skeleton className="h-4 max-w-sm rounded-md" />
              </div>
              <Skeleton className="h-[220px] w-full rounded-lg" />
            </SkeletonCardFrame>
            <SkeletonCardFrame className="min-h-[18rem] space-y-4 lg:col-span-2">
              <div className="space-y-2">
                <Skeleton className="h-5 w-48 rounded-md" />
                <Skeleton className="h-4 max-w-xs rounded-md" />
              </div>
              <Skeleton className="h-[220px] w-full rounded-lg" />
            </SkeletonCardFrame>
          </div>
        </div>
      </div>
    );
  }

  if (!anyWidget) {
    return (
      <div className="flex min-h-[min(70vh,32rem)] flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border/60 bg-muted/20 px-6 py-16 text-center">
        <p className="max-w-md text-sm text-muted-foreground sm:text-base">
          Für das Dashboard sind aktuell keine Widgets aktiviert. Unter
          Einstellungen kannst du Kennzahlen, Wetter und Diagramme wieder
          einblenden.
        </p>
        <Button render={<Link href="/settings/dashboard" prefetch />}>
          Dashboard-Einstellungen
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 pt-2">
      {sections.map((section) => {
        if (section.kind === "overviewStats") {
          return (
            <div
              key="overviewStats"
              className="grid min-w-0 gap-4 sm:grid-cols-3"
            >
              <Card className="min-w-0 border-border/50 shadow-card">
                <CardHeader className="pb-2">
                  <CardDescription>Gerichte</CardDescription>
                  <CardTitle className="text-3xl tabular-nums">
                    {stats.dishes}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card className="min-w-0 border-border/50 shadow-card">
                <CardHeader className="pb-2">
                  <CardDescription>Kategorien</CardDescription>
                  <CardTitle className="text-3xl tabular-nums">
                    {stats.categories}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card className="min-w-0 border-border/50 shadow-card">
                <CardHeader className="pb-2">
                  <CardDescription>Ø Preis</CardDescription>
                  <CardTitle className="text-3xl tabular-nums">
                    {stats.dishes ? `${stats.avgPrice.toFixed(2)} €` : "—"}
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>
          );
        }

        if (section.kind === "weather") {
          return (
            <div key="weather" className="min-w-0">
              <DashboardWeatherTile />
            </div>
          );
        }

        const chartIds = section.widgetIds;
        const n = chartIds.length;
        return (
          <div
            key={`charts-${chartIds.join("-")}`}
            className={cn(
              "grid min-w-0 gap-6",
              n === 2 && "lg:grid-cols-5",
            )}
          >
            {chartIds.map((chartId, index) => {
              const spanTwo =
                n === 2 ? (index === 0 ? "lg:col-span-3" : "lg:col-span-2") : "";

              if (chartId === "activityChart") {
                return (
                  <Card
                    key={chartId}
                    className={cn(
                      "min-w-0 border-border/50 shadow-card",
                      spanTwo,
                    )}
                  >
                    <CardHeader>
                      <CardTitle className="text-lg">Aktivität</CardTitle>
                      <CardDescription>
                        Demo-Zeitreihe (echte Tracking-Daten folgen mit Analytics).
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pl-0">
                      <ChartContainer
                        config={trendConfig}
                        className="aspect-auto h-[260px] w-full min-w-0"
                      >
                        <AreaChart
                          accessibilityLayer
                          data={demoTrend}
                          margin={{ left: 8, right: 8, top: 8, bottom: 0 }}
                        >
                          <defs>
                            <linearGradient
                              id="fillViews"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="5%"
                                stopColor="var(--color-views)"
                                stopOpacity={0.35}
                              />
                              <stop
                                offset="95%"
                                stopColor="var(--color-views)"
                                stopOpacity={0.02}
                              />
                            </linearGradient>
                          </defs>
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
                            width={36}
                            tickMargin={8}
                            className="tabular-nums"
                          />
                          <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent indicator="line" />}
                          />
                          <Area
                            dataKey="views"
                            type="natural"
                            fill="url(#fillViews)"
                            stroke="var(--color-views)"
                            strokeWidth={2}
                          />
                        </AreaChart>
                      </ChartContainer>
                    </CardContent>
                  </Card>
                );
              }

              return (
                <Card
                  key={chartId}
                  className={cn(
                    "min-w-0 border-border/50 shadow-card",
                    spanTwo,
                  )}
                >
                  <CardHeader>
                    <CardTitle className="text-lg">Gerichte pro Kategorie</CardTitle>
                    <CardDescription>Aus deiner lokalen Speisekarte.</CardDescription>
                  </CardHeader>
                  <CardContent className="pl-0">
                    <ChartContainer
                      config={categoryConfig}
                      className="aspect-auto h-[260px] w-full min-w-0"
                    >
                      <BarChart
                        accessibilityLayer
                        data={byCategory}
                        layout="vertical"
                        margin={{ left: 4, right: 16, top: 8, bottom: 0 }}
                      >
                        <CartesianGrid
                          horizontal={false}
                          strokeDasharray="4 4"
                          className="stroke-border/50"
                        />
                        <XAxis type="number" hide />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={120}
                          tickLine={false}
                          axisLine={false}
                          tickMargin={8}
                          interval={0}
                        />
                        <ChartTooltip
                          cursor={false}
                          content={<ChartTooltipContent hideLabel indicator="dot" />}
                        />
                        <Bar
                          dataKey="count"
                          radius={6}
                          fill="var(--color-count)"
                          maxBarSize={28}
                        />
                      </BarChart>
                    </ChartContainer>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
