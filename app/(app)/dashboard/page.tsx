"use client";

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
import { Skeleton } from "@/components/ui/skeleton";
import { useCategoriesStorage } from "@/lib/hooks/use-categories-storage";
import { useMenuStorage } from "@/lib/hooks/use-menu-storage";

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
  const ready = menuReady && catReady;

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

  if (!ready) {
    return (
      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
        <Skeleton className="h-[280px] rounded-xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 p-4 pb-16 pt-6 sm:p-6 lg:p-8 lg:pt-8">
      <header className="space-y-1">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Übersicht
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="max-w-xl text-muted-foreground">
          Kennzahlen zur Speisekarte und Trend-Demos für spätere Live-Analytics.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-border/50 shadow-card">
          <CardHeader className="pb-2">
            <CardDescription>Gerichte</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {stats.dishes}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-border/50 shadow-card">
          <CardHeader className="pb-2">
            <CardDescription>Kategorien</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {stats.categories}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-border/50 shadow-card">
          <CardHeader className="pb-2">
            <CardDescription>Ø Preis</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {stats.dishes
                ? `${stats.avgPrice.toFixed(2)} €`
                : "—"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="border-border/50 shadow-card lg:col-span-3">
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
                  <linearGradient id="fillViews" x1="0" y1="0" x2="0" y2="1">
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

        <Card className="border-border/50 shadow-card lg:col-span-2">
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
      </div>
    </div>
  );
}
