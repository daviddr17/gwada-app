"use client";


import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  XAxis,
  YAxis,
} from "recharts";
import {
  CalendarClock,
  CalendarDays,
  Link2,
  Ticket,
} from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
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
  computeEventsStatistics,
  type EventsStatsPeriod,
} from "@/lib/events/compute-events-statistics";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { fetchEventsStatisticsBundle } from "@/lib/supabase/events-analytics-db";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { cn } from "@/lib/utils";

const monthConfig = {
  count: { label: "Events", color: "var(--accent)" },
} satisfies ChartConfig;

const weekdayConfig = {
  count: { label: "Events", color: "var(--chart-2)" },
} satisfies ChartConfig;

const platformConfig = {
  count: { label: "Events", color: "var(--chart-3)" },
} satisfies ChartConfig;

function ChartEmpty({ message }: { message: string }) {
  return (
    <p className="px-6 py-12 text-center text-sm text-muted-foreground">
      {message}
    </p>
  );
}

export function EventsStatisticsScreen() {
  const { restaurantId, supabaseEnvOk, ready: workspaceReady } =
    useWorkspaceRestaurantUuid();
  const [period, setPeriod] = useState<EventsStatsPeriod>(12);
  const [bundle, setBundle] = useState<Awaited<
    ReturnType<typeof fetchEventsStatisticsBundle>
  >["data"]>(null);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDeferredSkeleton(loading);

  useEffect(() => {
    if (!restaurantId) return;
    let cancel = false;
    setLoading(true);
    void (async () => {
      const { data, error } = await fetchEventsStatisticsBundle({
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
    return computeEventsStatistics({
      items: bundle.items,
      syncRows: bundle.syncRows,
      periodStart: bundle.periodStart,
      periodEnd: bundle.periodEnd,
    });
  }, [bundle]);

  const platformChartData = useMemo(
    () =>
      stats?.byPlatform.map((row) => ({
        name: row.label,
        count: row.count,
        fill: row.color,
      })) ?? [],
    [stats?.byPlatform],
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
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCardFrame key={i} className="h-24" />
          ))}
        </div>
      ) : stats ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Im Zeitraum"
            value={String(stats.itemsInPeriod)}
            hint={`${stats.totalItemsAll} gesamt im Feed`}
            icon={CalendarDays}
          />
          <KpiCard
            label="Bevorstehend"
            value={String(stats.upcomingCount)}
            hint="Start in der Zukunft"
            icon={CalendarClock}
          />
          <KpiCard
            label="Mit Ticket-Link"
            value={String(stats.withTicketLinkInPeriod)}
            hint="Im gewählten Zeitraum"
            icon={Ticket}
          />
          <KpiCard
            label="Top-Plattform"
            value={stats.topPlatform ?? "—"}
            hint={
              stats.gwadaItemsInPeriod > 0
                ? `${stats.gwadaItemsInPeriod} Gwada · ${stats.externalItemsInPeriod} extern`
                : undefined
            }
            icon={Link2}
          />
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/50 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Nach Monat</CardTitle>
          </CardHeader>
          <CardContent>
            {showSkeleton ? (
              <Skeleton className="h-[220px] w-full rounded-xl" />
            ) : stats && stats.byMonth.some((m) => m.count > 0) ? (
              <ChartContainer config={monthConfig} className="aspect-auto h-[220px] w-full">
                <BarChart data={stats.byMonth} margin={{ left: 0, right: 8, top: 8 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={11} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            ) : (
              <ChartEmpty message="Keine Events im gewählten Zeitraum." />
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Nach Wochentag</CardTitle>
          </CardHeader>
          <CardContent>
            {showSkeleton ? (
              <Skeleton className="h-[220px] w-full rounded-xl" />
            ) : stats && stats.byWeekday.some((d) => d.count > 0) ? (
              <ChartContainer config={weekdayConfig} className="aspect-auto h-[220px] w-full">
                <BarChart data={stats.byWeekday} margin={{ left: 0, right: 8, top: 8 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={11} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            ) : (
              <ChartEmpty message="Keine Events im gewählten Zeitraum." />
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-card lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Nach Plattform</CardTitle>
          </CardHeader>
          <CardContent>
            {showSkeleton ? (
              <Skeleton className="h-[220px] w-full rounded-xl" />
            ) : platformChartData.length > 0 ? (
              <ChartContainer config={platformConfig} className="aspect-auto h-[220px] w-full">
                <BarChart data={platformChartData} margin={{ left: 0, right: 8, top: 8 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {platformChartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            ) : (
              <ChartEmpty message="Noch keine Events erfasst." />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
