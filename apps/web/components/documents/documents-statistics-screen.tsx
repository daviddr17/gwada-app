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
  FileStack,
  HardDrive,
  History,
  Tag,
  Upload,
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
  computeDocumentStatistics,
  formatDocumentBytes,
  type DocumentStatsPeriod,
} from "@/lib/documents/compute-document-statistics";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { fetchDocumentStatisticsBundle } from "@/lib/supabase/documents-analytics-db";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { cn } from "@/lib/utils";

const monthConfig = {
  count: { label: "Dokumente", color: "var(--accent)" },
} satisfies ChartConfig;

const weekdayConfig = {
  count: { label: "Dokumente", color: "var(--chart-2)" },
} satisfies ChartConfig;

const tagConfig = {
  count: { label: "Dokumente", color: "var(--chart-1)" },
} satisfies ChartConfig;

const actionConfig = {
  count: { label: "Aktionen", color: "var(--chart-3)" },
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
  icon: typeof FileStack;
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

export function DocumentsStatisticsScreen() {
  const { restaurantId, supabaseEnvOk, ready: workspaceReady } =
    useWorkspaceRestaurantUuid();
  const [period, setPeriod] = useState<DocumentStatsPeriod>(12);
  const [bundle, setBundle] = useState<Awaited<
    ReturnType<typeof fetchDocumentStatisticsBundle>
  >["data"]>(null);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDeferredSkeleton(loading);

  useEffect(() => {
    if (!restaurantId) return;
    let cancel = false;
    setLoading(true);
    void (async () => {
      const { data, error } = await fetchDocumentStatisticsBundle({
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
    return computeDocumentStatistics({
      documents: bundle.documents,
      logEntries: bundle.logEntries,
      documentsBytes: bundle.documentsBytes,
      periodStart: bundle.periodStart,
      periodEnd: bundle.periodEnd,
    });
  }, [bundle]);

  const actionChartData = useMemo(
    () =>
      stats?.byAction.map((row) => ({
        name: row.label,
        count: row.count,
        fill: row.fill,
      })) ?? [],
    [stats?.byAction],
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
              icon={FileStack}
              label="Dokumente gesamt"
              value={String(stats.totalDocuments)}
              hint={`${stats.documentsInPeriod} im Zeitraum`}
            />
            <KpiCard
              icon={Upload}
              label="Uploads im Zeitraum"
              value={String(stats.uploadsInPeriod)}
              hint={`${stats.logActionsInPeriod} Log-Aktionen`}
            />
            <KpiCard
              icon={HardDrive}
              label="Speicher"
              value={formatDocumentBytes(stats.documentsBytes)}
              hint={`+${formatDocumentBytes(stats.bytesAddedInPeriod)} im Zeitraum`}
            />
            <KpiCard
              icon={HardDrive}
              label="Ø Dateigröße"
              value={
                stats.avgFileSizeBytes != null
                  ? formatDocumentBytes(stats.avgFileSizeBytes)
                  : "—"
              }
              hint="Über alle Dokumente"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              icon={Tag}
              label="Mit / Ohne Tag"
              value={`${stats.withTagCount} / ${stats.withoutTagCount}`}
              hint="Nach Tag-Zuordnung"
            />
            <KpiCard
              icon={History}
              label="Log-Aktionen"
              value={String(stats.logActionsInPeriod)}
              hint={
                stats.topAction
                  ? `Häufigste: ${stats.topAction}`
                  : "Im gewählten Zeitraum"
              }
            />
            <KpiCard
              icon={Tag}
              label="Beliebtester Tag"
              value={stats.topTag ?? "—"}
              hint="Nach Anzahl Dokumente"
            />
            <KpiCard
              icon={FileStack}
              label="Im Zeitraum"
              value={String(stats.documentsInPeriod)}
              hint="Neu hochgeladene Dokumente"
            />
          </div>
        </>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="min-w-0 border-border/50 shadow-card">
          <CardHeader>
            <CardTitle className="text-lg">Verlauf pro Monat</CardTitle>
            <CardDescription>
              Neue Dokumente im gewählten Zeitraum.
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            {showSkeleton ? (
              <Skeleton className="mx-6 h-[240px] w-auto rounded-xl" />
            ) : !stats || stats.byMonth.length === 0 ? (
              <ChartEmpty message="Noch keine Dokumente im gewählten Zeitraum." />
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
            <CardTitle className="text-lg">Wochentage</CardTitle>
            <CardDescription>
              Wann Dokumente hochgeladen wurden.
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            {showSkeleton ? (
              <Skeleton className="mx-6 h-[240px] w-auto rounded-xl" />
            ) : !stats || stats.documentsInPeriod === 0 ? (
              <ChartEmpty message="Noch keine Dokumente im gewählten Zeitraum." />
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

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="min-w-0 border-border/50 shadow-card">
          <CardHeader>
            <CardTitle className="text-lg">Nach Tag</CardTitle>
            <CardDescription>
              Häufigste Tags über alle Dokumente.
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            {showSkeleton ? (
              <Skeleton className="mx-6 h-[280px] w-auto rounded-xl" />
            ) : !stats || stats.byTag.length === 0 ? (
              <ChartEmpty message="Noch keine Dokumente vorhanden." />
            ) : (
              <ChartContainer
                config={tagConfig}
                className="aspect-auto h-[280px] w-full min-w-0"
              >
                <BarChart
                  accessibilityLayer
                  data={stats.byTag}
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
            <CardTitle className="text-lg">Log-Aktionen</CardTitle>
            <CardDescription>
              Uploads, Änderungen und Notizen im Zeitraum.
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            {showSkeleton ? (
              <Skeleton className="mx-6 h-[280px] w-auto rounded-xl" />
            ) : !stats || actionChartData.length === 0 ? (
              <ChartEmpty message="Noch keine Log-Einträge im Zeitraum." />
            ) : (
              <ChartContainer
                config={actionConfig}
                className="aspect-auto h-[280px] w-full min-w-0"
              >
                <BarChart
                  accessibilityLayer
                  data={actionChartData}
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
                    {actionChartData.map((entry) => (
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
