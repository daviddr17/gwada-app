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
  CalendarDays,
  Clock,
  FileText,
  Users,
} from "lucide-react";
import { toast } from "sonner";
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
  computeStaffStatistics,
  formatStaffStatsAvgHours,
  formatStaffStatsHours,
  type StaffStatsPeriod,
} from "@/lib/staff/compute-staff-statistics";
import { formatStaffEuroCents } from "@/lib/staff/staff-day-wage";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { fetchStaffStatisticsBundle } from "@/lib/supabase/staff-statistics-db";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { cn } from "@/lib/utils";

const weekHoursConfig = {
  hours: { label: "Arbeitsstunden", color: "var(--accent)" },
} satisfies ChartConfig;

const shiftWeekdayConfig = {
  count: { label: "Schichten", color: "var(--chart-2)" },
} satisfies ChartConfig;

const shiftStatusConfig = {
  count: { label: "Schichten", color: "var(--chart-3)" },
} satisfies ChartConfig;

const positionConfig = {
  count: { label: "Mitarbeiter", color: "var(--chart-1)" },
} satisfies ChartConfig;

const topStaffConfig = {
  hours: { label: "Netto-Arbeitszeit", color: "var(--chart-4)" },
} satisfies ChartConfig;

const payTypeConfig = {
  count: { label: "Verträge", color: "var(--chart-5)" },
} satisfies ChartConfig;

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: typeof Users;
}) {
  return (
    <Card className="border-border/50 shadow-card">
      <CardContent className="flex gap-3 pt-4 pb-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
          <Icon className="size-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-0.5 text-2xl font-semibold tracking-tight tabular-nums">
            {value}
          </p>
          {hint ? (
            <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function ChartEmpty({ message }: { message: string }) {
  return (
    <p className="px-6 py-12 text-center text-sm text-muted-foreground">
      {message}
    </p>
  );
}

export function StaffStatisticsScreen() {
  const { restaurantId, supabaseEnvOk, ready: workspaceReady } =
    useWorkspaceRestaurantUuid();
  const [period, setPeriod] = useState<StaffStatsPeriod>(12);
  const [bundle, setBundle] = useState<Awaited<
    ReturnType<typeof fetchStaffStatisticsBundle>
  >["data"]>(null);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDeferredSkeleton(loading);

  useEffect(() => {
    if (!restaurantId) return;
    let cancel = false;
    setLoading(true);
    void (async () => {
      const { data, error } = await fetchStaffStatisticsBundle({
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
    return computeStaffStatistics({
      staff: bundle.staff,
      contracts: bundle.contracts,
      workEntries: bundle.workEntries,
      shifts: bundle.shifts,
      presence: bundle.presence,
      periodStart: bundle.periodStart,
      periodEnd: bundle.periodEnd,
    });
  }, [bundle]);

  const shiftStatusChartData = useMemo(
    () =>
      stats?.byShiftStatus.map((s) => ({
        name: s.label,
        count: s.count,
        fill: s.color,
      })) ?? [],
    [stats?.byShiftStatus],
  );

  const payTypeChartData = useMemo(
    () =>
      stats?.byPayType.map((p) => ({
        name: p.label,
        count: p.count,
      })) ?? [],
    [stats?.byPayType],
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

  const wageHint =
    stats && stats.shiftCoverageNotes.length > 0
      ? stats.shiftCoverageNotes.join(" · ")
      : stats && stats.shiftPlanWageCents > 0
        ? "Stundenlohn-Schichten im Zeitraum"
        : "Keine stundenbasierten Schichten";

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
              icon={Users}
              label="Aktives Team"
              value={String(stats.totalActiveStaff)}
              hint={
                stats.inactiveStaff > 0
                  ? `${stats.inactiveStaff} inaktiv`
                  : "Alle Mitarbeiter aktiv"
              }
            />
            <KpiCard
              icon={Clock}
              label="Gerade im Dienst"
              value={String(stats.currentlyWorking)}
              hint={
                stats.currentlyOnBreak > 0
                  ? `${stats.currentlyOnBreak} in Pause`
                  : "Live-Status (Display & manuell)"
              }
            />
            <KpiCard
              icon={FileText}
              label="Aktive Verträge"
              value={String(stats.activeContractsToday)}
              hint={
                stats.staffWithoutContractToday > 0
                  ? `${stats.staffWithoutContractToday} ohne Vertrag heute`
                  : "Heute gültige Verträge"
              }
            />
            <KpiCard
              icon={CalendarDays}
              label="Geplante Schichten"
              value={String(stats.shiftCount)}
              hint={`${formatStaffStatsHours(stats.plannedHours)} geplant`}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              icon={Clock}
              label="Netto-Arbeitszeit"
              value={formatStaffStatsHours(stats.netWorkHours)}
              hint={`Pause ${formatStaffStatsHours(stats.breakHours)}`}
            />
            <KpiCard
              icon={Users}
              label="Ø pro Mitarbeiter"
              value={formatStaffStatsAvgHours(stats.avgNetHoursPerActiveStaff)}
              hint="Netto im gewählten Zeitraum"
            />
            <KpiCard
              icon={CalendarDays}
              label="Abwesenheit"
              value={`${stats.vacationDays + stats.sickDays}`}
              hint={`${stats.vacationDays} Urlaub · ${stats.sickDays} Krank`}
            />
            <KpiCard
              icon={FileText}
              label="Schicht-Lohn (Std.)"
              value={formatStaffEuroCents(stats.shiftPlanWageCents)}
              hint={wageHint}
            />
          </div>
        </>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="min-w-0 border-border/50 shadow-card">
          <CardHeader>
            <CardTitle className="text-lg">Arbeitszeit pro Woche</CardTitle>
            <CardDescription>
              Erfasste Arbeitsstunden (Brutto) nach Kalenderwoche im Zeitraum.
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            {showSkeleton ? (
              <Skeleton className="mx-6 h-[240px] w-auto rounded-xl" />
            ) : !stats || stats.byWeek.length === 0 ? (
              <ChartEmpty message="Noch keine Arbeitszeiten im gewählten Zeitraum." />
            ) : (
              <ChartContainer
                config={weekHoursConfig}
                className="aspect-auto h-[260px] w-full min-w-0"
              >
                <LineChart
                  accessibilityLayer
                  data={stats.byWeek}
                  margin={{ left: 4, right: 8, top: 8, bottom: 0 }}
                >
                  <CartesianGrid vertical={false} strokeDasharray="4 4" />
                  <XAxis
                    dataKey="week"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    className="text-[10px]"
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={40}
                    className="tabular-nums"
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) =>
                          formatStaffStatsHours(Number(value))
                        }
                      />
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="hours"
                    stroke="var(--color-hours)"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "var(--color-hours)" }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0 border-border/50 shadow-card">
          <CardHeader>
            <CardTitle className="text-lg">Schichten nach Wochentag</CardTitle>
            <CardDescription>
              Geplante Schichten Mo–So (ohne abgelehnte).
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            {showSkeleton ? (
              <Skeleton className="mx-6 h-[240px] w-auto rounded-xl" />
            ) : !stats || stats.shiftCount === 0 ? (
              <ChartEmpty message="Noch keine Schichten im gewählten Zeitraum." />
            ) : (
              <ChartContainer
                config={shiftWeekdayConfig}
                className="aspect-auto h-[260px] w-full min-w-0"
              >
                <BarChart
                  accessibilityLayer
                  data={stats.byShiftWeekday}
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

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="min-w-0 border-border/50 shadow-card">
          <CardHeader>
            <CardTitle className="text-lg">Schicht-Status</CardTitle>
            <CardDescription>
              Bestätigt, ausstehend oder abgelehnt im Zeitraum.
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            {showSkeleton ? (
              <Skeleton className="mx-6 h-[240px] w-auto rounded-xl" />
            ) : !stats || stats.shiftCount === 0 ? (
              <ChartEmpty message="Noch keine Schichten im gewählten Zeitraum." />
            ) : (
              <ChartContainer
                config={shiftStatusConfig}
                className="aspect-auto h-[260px] w-full min-w-0"
              >
                <BarChart
                  accessibilityLayer
                  data={shiftStatusChartData}
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
                    {shiftStatusChartData.map((entry) => (
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
            <CardTitle className="text-lg">Vergütungsarten</CardTitle>
            <CardDescription>
              Heute gültige Verträge nach Vergütungsmodell.
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            {showSkeleton ? (
              <Skeleton className="mx-6 h-[240px] w-auto rounded-xl" />
            ) : !stats || payTypeChartData.length === 0 ? (
              <ChartEmpty message="Keine gültigen Verträge für heute." />
            ) : (
              <ChartContainer
                config={payTypeConfig}
                className="aspect-auto h-[260px] w-full min-w-0"
              >
                <BarChart
                  accessibilityLayer
                  data={payTypeChartData}
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
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="min-w-0 border-border/50 shadow-card lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Team nach Position</CardTitle>
            <CardDescription>
              Aktive Mitarbeiter nach Restaurant-Position.
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            {showSkeleton ? (
              <Skeleton className="mx-6 h-[280px] w-auto rounded-xl" />
            ) : !stats || stats.byPosition.length === 0 ? (
              <ChartEmpty message="Noch keine Positionen zugeordnet." />
            ) : (
              <ChartContainer
                config={positionConfig}
                className="aspect-auto h-[280px] w-full min-w-0"
              >
                <BarChart
                  accessibilityLayer
                  data={stats.byPosition}
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
                    width={96}
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

        <Card className="min-w-0 border-border/50 shadow-card lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-lg">Top Arbeitszeiten</CardTitle>
            <CardDescription>
              Netto-Arbeitszeit pro Mitarbeiter im gewählten Zeitraum.
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            {showSkeleton ? (
              <Skeleton className="mx-6 h-[280px] w-auto rounded-xl" />
            ) : !stats || stats.topStaffByHours.length === 0 ? (
              <ChartEmpty message="Noch keine Arbeitszeiten erfasst." />
            ) : (
              <ChartContainer
                config={topStaffConfig}
                className="aspect-auto h-[280px] w-full min-w-0"
              >
                <BarChart
                  accessibilityLayer
                  data={stats.topStaffByHours}
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
                    width={40}
                    className="tabular-nums"
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) =>
                          formatStaffStatsHours(Number(value))
                        }
                      />
                    }
                  />
                  <Bar
                    dataKey="hours"
                    fill="var(--color-hours)"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
