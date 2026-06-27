"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
import { toast } from "sonner";
import { KpiCard } from "@/components/ui/kpi-card";
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
import {
  computeReservationStats,
  type ReservationStatsPeriod,
} from "@/lib/reservations/compute-reservation-stats";
import { fetchReservationsForAnalytics } from "@/lib/supabase/reservations-analytics-db";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { cn } from "@/lib/utils";

const hourConfig = {
  count: { label: "Reservierungen", color: "var(--chart-1)" },
} satisfies ChartConfig;

const weekdayConfig = {
  count: { label: "Reservierungen", color: "var(--chart-2)" },
} satisfies ChartConfig;

const monthConfig = {
  count: { label: "Reservierungen", color: "var(--accent)" },
} satisfies ChartConfig;

const statusConfig = {
  count: { label: "Anzahl", color: "var(--chart-3)" },
} satisfies ChartConfig;

export function ReservationsStatisticsScreen() {
  const { restaurantId, supabaseEnvOk, ready: workspaceReady } =
    useWorkspaceRestaurantUuid();
  const [period, setPeriod] = useState<ReservationStatsPeriod>(12);
  const [rows, setRows] = useState<Awaited<
    ReturnType<typeof fetchReservationsForAnalytics>
  >["data"]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!restaurantId) return;
    let cancel = false;
    setLoading(true);
    void (async () => {
      const { data, error } = await fetchReservationsForAnalytics({
        restaurantId,
        monthsBack: period,
      });
      if (cancel) return;
      setLoading(false);
      if (error) toast.error(error.message);
      else setRows(data);
    })();
    return () => {
      cancel = true;
    };
  }, [restaurantId, period]);

  const stats = useMemo(() => computeReservationStats(rows), [rows]);

  const statusChartData = useMemo(
    () =>
      stats.byStatus.map((s) => ({
        name: s.name,
        count: s.count,
        fill: s.color,
      })),
    [stats.byStatus],
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
    <div className="space-y-6 pb-4">
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

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCardFrame key={i} className="min-h-[5.5rem] py-4">
              <Skeleton className="h-3 w-24 rounded-md" />
              <Skeleton className="mt-3 h-8 w-16 rounded-lg" />
            </SkeletonCardFrame>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Reservierungen"
            value={String(stats.totalInPeriod)}
            hint={`${stats.bookingIntentCount} mit Buchungsabsicht`}
          />
          <KpiCard
            label="Ø Vorlaufzeit"
            value={
              stats.avgLeadDays != null ? `${stats.avgLeadDays} Tage` : "—"
            }
            hint={
              stats.medianLeadDays != null
                ? `Median ${stats.medianLeadDays} Tage`
                : "Angelegt bis Termin (pending/bestätigt)"
            }
          />
          <KpiCard
            label="Ø Personenzahl"
            value={stats.avgPartySize != null ? String(stats.avgPartySize) : "—"}
            hint={`${stats.totalGuests} Gäste gesamt`}
          />
          <KpiCard
            label="Beliebtester Tag"
            value={stats.topWeekday ?? "—"}
            hint="Wochentag nach Terminbeginn"
          />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="min-w-0 border-border/50 shadow-card">
          <CardHeader>
            <CardTitle className="text-lg">Uhrzeiten</CardTitle>
            <CardDescription>
              Wann starten bestätigte und offene Reservierungen (nach
              Terminbeginn).
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            {loading ? (
              <Skeleton className="mx-6 h-[240px] w-auto rounded-xl" />
            ) : (
              <ChartContainer
                config={hourConfig}
                className="aspect-auto h-[260px] w-full min-w-0"
              >
                <BarChart
                  accessibilityLayer
                  data={stats.byHour}
                  margin={{ left: 4, right: 8, top: 8, bottom: 0 }}
                >
                  <CartesianGrid vertical={false} strokeDasharray="4 4" />
                  <XAxis
                    dataKey="hour"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    interval={2}
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
                  <Bar
                    dataKey="count"
                    fill="var(--color-count)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0 border-border/50 shadow-card">
          <CardHeader>
            <CardTitle className="text-lg">Wochentage</CardTitle>
            <CardDescription>
              Verteilung der Termine Mo–So (Buchungsabsicht).
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            {loading ? (
              <Skeleton className="mx-6 h-[240px] w-auto rounded-xl" />
            ) : (
              <ChartContainer
                config={weekdayConfig}
                className="aspect-auto h-[260px] w-full min-w-0"
              >
                <BarChart
                  accessibilityLayer
                  data={stats.byWeekday}
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

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="min-w-0 border-border/50 shadow-card lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-lg">Verlauf pro Monat</CardTitle>
            <CardDescription>
              Anzahl Reservierungen mit Termin im Zeitraum (ohne No-Show).
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            {loading ? (
              <Skeleton className="mx-6 h-[240px] w-auto rounded-xl" />
            ) : stats.byMonth.length === 0 ? (
              <p className="px-6 py-12 text-center text-sm text-muted-foreground">
                Noch keine Daten im gewählten Zeitraum.
              </p>
            ) : (
              <ChartContainer
                config={monthConfig}
                className="aspect-auto h-[260px] w-full min-w-0"
              >
                <LineChart
                  accessibilityLayer
                  data={stats.byMonth}
                  margin={{ left: 8, right: 8, top: 8, bottom: 0 }}
                >
                  <CartesianGrid vertical={false} strokeDasharray="4 4" />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={12}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={36}
                    allowDecimals={false}
                  />
                  <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="var(--color-count)"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "var(--color-count)" }}
                  />
                </LineChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0 border-border/50 shadow-card lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Status</CardTitle>
            <CardDescription>Verteilung im Zeitraum.</CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            {loading ? (
              <Skeleton className="mx-6 h-[240px] w-auto rounded-xl" />
            ) : statusChartData.length === 0 ? (
              <p className="px-6 py-12 text-center text-sm text-muted-foreground">
                Keine Statusdaten.
              </p>
            ) : (
              <ChartContainer
                config={statusConfig}
                className="aspect-auto h-[260px] w-full min-w-0"
              >
                <BarChart
                  accessibilityLayer
                  data={statusChartData}
                  layout="vertical"
                  margin={{ left: 4, right: 12, top: 8, bottom: 0 }}
                >
                  <CartesianGrid horizontal={false} strokeDasharray="4 4" />
                  <XAxis type="number" allowDecimals={false} hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={88}
                    tickLine={false}
                    axisLine={false}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
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
    </div>
  );
}
