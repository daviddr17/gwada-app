"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
  EyeOff,
  Link2,
  MessageSquare,
  Star,
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
import { PlatformFeedSyncStatusBar } from "@/components/platform-feed/platform-feed-sync-status-bar";
import { Skeleton, SkeletonCardFrame } from "@/components/ui/skeleton";
import {
  formatReviewRating,
  type ReviewStatsPeriod,
} from "@/lib/reviews/compute-review-statistics";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import {
  fetchReviewStatisticsBundle,
  fetchReviewStatisticsRevision,
} from "@/lib/reviews/fetch-review-statistics-bundle";
import {
  mergeReviewStatisticsSyncMeta,
  peekReviewStatisticsCache,
  writeReviewStatisticsCache,
} from "@/lib/reviews/reviews-statistics-client-cache";
import { reviewsStatisticsBundleSyncToMeta } from "@/lib/reviews/reviews-statistics-sync-meta";
import { REVIEW_PLATFORM_LABELS } from "@/lib/constants/review-platforms";
import type { ReviewStatisticsBundle } from "@/lib/supabase/reviews-analytics-db";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { cn } from "@/lib/utils";

const monthCountConfig = {
  count: { label: "Bewertungen", color: "var(--accent)" },
} satisfies ChartConfig;

const monthAvgConfig = {
  average: { label: "Ø Sterne", color: "var(--chart-1)" },
} satisfies ChartConfig;

const weekdayConfig = {
  count: { label: "Bewertungen", color: "var(--chart-2)" },
} satisfies ChartConfig;

const platformConfig = {
  count: { label: "Bewertungen", color: "var(--chart-3)" },
} satisfies ChartConfig;

const starConfig = {
  count: { label: "Bewertungen", color: "var(--chart-4)" },
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
  icon: typeof Star;
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

export function ReviewsStatisticsScreen() {
  const { restaurantId, supabaseEnvOk, ready: workspaceReady } =
    useWorkspaceRestaurantUuid();
  const [period, setPeriod] = useState<ReviewStatsPeriod>(12);
  const [bundle, setBundle] = useState<ReviewStatisticsBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const showSkeleton = useDeferredSkeleton(loading && !bundle);
  const followUpSyncKeyRef = useRef<string | null>(null);
  const pollTimerRef = useRef<number | null>(null);
  const loadRef = useRef<
    (options?: { mode?: "initial" | "poll" }) => Promise<void>
  >(() => Promise.resolve());

  const clearPollTimer = useCallback(() => {
    if (pollTimerRef.current != null) {
      window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const scheduleSyncPoll = useCallback(
    (delayMs = 5000) => {
      clearPollTimer();
      pollTimerRef.current = window.setTimeout(() => {
        void loadRef.current({ mode: "poll" });
      }, delayMs);
    },
    [clearPollTimer],
  );

  const load = useCallback(
    async (options?: { mode?: "initial" | "poll" }) => {
      if (!restaurantId) return;
      const mode = options?.mode ?? "initial";

      if (mode === "initial") {
        const cached = peekReviewStatisticsCache(restaurantId, period);
        if (cached) {
          setBundle(cached);
          setLoading(false);
        } else {
          setLoading(true);
        }
      }

      const { data: revision, error: revisionError } =
        await fetchReviewStatisticsRevision({
          restaurantId,
          monthsBack: period,
        });

      if (revisionError) {
        if (mode === "initial") toast.error(revisionError);
        if (mode === "initial") setLoading(false);
        return;
      }

      if (!revision) {
        if (mode === "initial") setLoading(false);
        return;
      }

      const cached = peekReviewStatisticsCache(restaurantId, period);
      if (cached?.revision === revision.revision) {
        const merged = mergeReviewStatisticsSyncMeta(cached, revision.sync);
        if (merged !== cached) {
          setBundle(merged);
          writeReviewStatisticsCache(restaurantId, period, merged);
        }

        const syncPending =
          revision.sync.syncTriggered ||
          revision.sync.google.stale ||
          revision.sync.facebook.stale;
        if (syncPending) {
          scheduleSyncPoll();
        } else {
          clearPollTimer();
        }

        if (mode === "initial") setLoading(false);
        return;
      }

      const { data, error } = await fetchReviewStatisticsBundle({
        restaurantId,
        monthsBack: period,
      });

      if (error) {
        if (mode === "initial") toast.error(error);
        if (mode === "initial") setLoading(false);
        return;
      }

      if (data) {
        setBundle(data);
        writeReviewStatisticsCache(restaurantId, period, data);
        if (
          data.sync.syncTriggered ||
          data.sync.google.stale ||
          data.sync.facebook.stale
        ) {
          const syncKey = `${restaurantId}:${period}`;
          if (followUpSyncKeyRef.current !== syncKey) {
            followUpSyncKeyRef.current = syncKey;
            scheduleSyncPoll(8000);
          }
        } else {
          clearPollTimer();
        }
      }
      if (mode === "initial") setLoading(false);
    },
    [restaurantId, period, scheduleSyncPoll, clearPollTimer],
  );

  loadRef.current = load;

  const syncMeta = useMemo(
    () => reviewsStatisticsBundleSyncToMeta(bundle?.sync),
    [bundle?.sync],
  );

  const syncNow = useCallback(async () => {
    if (!restaurantId || syncing) return;
    setSyncing(true);
    try {
      const res = await fetch("/api/reviews/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId }),
      });
      if (!res.ok) throw new Error("sync_failed");
      await load({ mode: "poll" });
      toast.success("Synchronisiert.");
    } catch {
      toast.error("Synchronisierung fehlgeschlagen.");
    } finally {
      setSyncing(false);
    }
  }, [restaurantId, syncing, load]);

  useLayoutEffect(() => {
    if (!restaurantId) return;
    const cached = peekReviewStatisticsCache(restaurantId, period);
    if (cached) {
      setBundle(cached);
      setLoading(false);
    }
  }, [restaurantId, period]);

  useEffect(() => {
    followUpSyncKeyRef.current = null;
    clearPollTimer();
  }, [restaurantId, period, clearPollTimer]);

  useEffect(() => {
    if (!restaurantId) return;
    void load({ mode: "initial" });
    return () => {
      clearPollTimer();
    };
  }, [restaurantId, period, load, clearPollTimer]);

  const stats = bundle?.stats ?? null;

  const platformChartData = useMemo(
    () =>
      stats?.byPlatform.map((p) => ({
        name: p.label,
        count: p.count,
        fill: p.color,
      })) ?? [],
    [stats?.byPlatform],
  );

  const starChartData = useMemo(
    () =>
      stats?.byStar.map((s) => ({
        name: s.star,
        count: s.count,
        fill: s.fill,
      })) ?? [],
    [stats?.byStar],
  );

  if (!supabaseEnvOk) {
    return (
      <p className="text-sm text-muted-foreground">
        Supabase-Umgebungsvariablen fehlen.
      </p>
    );
  }

  if (!workspaceReady) {
    return <WorkspaceRestaurantResolvePlaceholder />;
  }

  if (!restaurantId) {
    return <WorkspaceRestaurantMissingMessage />;
  }

  return (
    <div className="space-y-6 pb-4">
      <PlatformFeedSyncStatusBar
        syncMeta={syncMeta}
        syncing={syncing}
        onSyncNow={() => void syncNow()}
        platformLabels={REVIEW_PLATFORM_LABELS}
      />

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
              icon={Star}
              label="Bewertungen"
              value={String(stats.totalReviews)}
              hint={
                stats.topPlatform
                  ? `Meiste über ${stats.topPlatform}`
                  : "Im gewählten Zeitraum"
              }
            />
            <KpiCard
              icon={Star}
              label="Durchschnitt"
              value={formatReviewRating(stats.averageRating)}
              hint={
                stats.medianRating != null
                  ? `Median ${formatReviewRating(stats.medianRating)} Sterne`
                  : "Alle Plattformen gemischt"
              }
            />
            <KpiCard
              icon={Star}
              label="5-Sterne"
              value={String(stats.fiveStarCount)}
              hint={`${stats.lowRatingCount} mit 1–2 Sternen`}
            />
            <KpiCard
              icon={MessageSquare}
              label="Mit Kommentar"
              value={String(stats.withCommentCount)}
              hint={`${stats.withReplyCount} mit Antwort`}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              icon={Link2}
              label="Gwada-Einladungen"
              value={String(stats.invitationsCreated)}
              hint={`${stats.invitationsLinkSent} Link${stats.invitationsLinkSent === 1 ? "" : "s"} versendet`}
            />
            <KpiCard
              icon={Link2}
              label="Einladung → Bewertung"
              value={
                stats.invitationConversionPercent != null
                  ? `${stats.invitationConversionPercent}%`
                  : "—"
              }
              hint={`${stats.invitationsCompleted} abgeschlossen`}
            />
            <KpiCard
              icon={Star}
              label="Mit Reservierung"
              value={String(stats.reservationLinkedCount)}
              hint="Gwada-Bewertungen mit Bezug"
            />
            <KpiCard
              icon={EyeOff}
              label="Ausgeblendet"
              value={String(stats.hiddenCount)}
              hint="Nicht im öffentlichen Embed"
            />
          </div>
        </>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="min-w-0 border-border/50 shadow-card">
          <CardHeader>
            <CardTitle className="text-lg">Sterne-Verteilung</CardTitle>
            <CardDescription>
              Anzahl Bewertungen pro Sternebewertung im Zeitraum.
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            {showSkeleton ? (
              <Skeleton className="mx-6 h-[240px] w-auto rounded-xl" />
            ) : !stats || stats.totalReviews === 0 ? (
              <ChartEmpty message="Noch keine Bewertungen im gewählten Zeitraum." />
            ) : (
              <ChartContainer
                config={starConfig}
                className="aspect-auto h-[260px] w-full min-w-0"
              >
                <BarChart
                  accessibilityLayer
                  data={starChartData}
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
                    {starChartData.map((entry) => (
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
            <CardTitle className="text-lg">Nach Plattform</CardTitle>
            <CardDescription>
              Gwada, Google und Facebook im Zeitraum.
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            {showSkeleton ? (
              <Skeleton className="mx-6 h-[240px] w-auto rounded-xl" />
            ) : !stats || platformChartData.length === 0 ? (
              <ChartEmpty message="Noch keine Bewertungen im gewählten Zeitraum." />
            ) : (
              <ChartContainer
                config={platformConfig}
                className="aspect-auto h-[260px] w-full min-w-0"
              >
                <BarChart
                  accessibilityLayer
                  data={platformChartData}
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
                    {platformChartData.map((entry) => (
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
            <CardTitle className="text-lg">Verlauf pro Monat</CardTitle>
            <CardDescription>
              Anzahl neuer Bewertungen im Zeitraum.
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            {showSkeleton ? (
              <Skeleton className="mx-6 h-[240px] w-auto rounded-xl" />
            ) : !stats || stats.byMonth.length === 0 ? (
              <ChartEmpty message="Noch keine Bewertungen im gewählten Zeitraum." />
            ) : (
              <ChartContainer
                config={monthCountConfig}
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
            <CardTitle className="text-lg">Ø Bewertung pro Monat</CardTitle>
            <CardDescription>
              Entwicklung des Durchschnitts im Zeitraum.
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            {showSkeleton ? (
              <Skeleton className="mx-6 h-[240px] w-auto rounded-xl" />
            ) : !stats || stats.byMonthAverage.length === 0 ? (
              <ChartEmpty message="Noch keine Bewertungen im gewählten Zeitraum." />
            ) : (
              <ChartContainer
                config={monthAvgConfig}
                className="aspect-auto h-[260px] w-full min-w-0"
              >
                <LineChart
                  accessibilityLayer
                  data={stats.byMonthAverage}
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
                    domain={[1, 5]}
                    className="tabular-nums"
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) =>
                          `${formatReviewRating(Number(value))} ★`
                        }
                      />
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="average"
                    stroke="var(--color-average)"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "var(--color-average)" }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="min-w-0 border-border/50 shadow-card">
        <CardHeader>
          <CardTitle className="text-lg">Wochentage</CardTitle>
          <CardDescription>
            Wann Bewertungen eingehen — nach Erstellungsdatum.
          </CardDescription>
        </CardHeader>
        <CardContent className="pl-0">
          {showSkeleton ? (
            <Skeleton className="mx-6 h-[240px] w-auto rounded-xl" />
          ) : !stats || stats.totalReviews === 0 ? (
            <ChartEmpty message="Noch keine Bewertungen im gewählten Zeitraum." />
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
  );
}
