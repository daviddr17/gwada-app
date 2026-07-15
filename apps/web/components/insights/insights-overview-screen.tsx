"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  CalendarDays,
  MessageCircle,
  MessageSquare,
  Newspaper,
  Star,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { GwadaUsageInsightsPanels } from "@/components/insights/gwada-usage-insights-panels";
import { LexofficeInsightsPanels } from "@/components/insights/lexoffice-insights-panels";
import { InsightsPlatformFilterChips } from "@/components/insights/insights-platform-filter-chips";
import {
  FacebookInsightsPanels,
  GoogleInsightsPanels,
  InstagramInsightsPanels,
} from "@/components/insights/insights-platform-panels";
import { InsightsOverviewSkeleton } from "@/components/insights/insights-overview-skeleton";
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
import {
  INSIGHTS_PLATFORM_DEFAULT,
  parseInsightsPlatform,
  type InsightsPlatform,
} from "@/lib/constants/insights-platforms";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import type {
  InsightsStatisticsResult,
  InsightsStatsDays,
  InsightsStatsPeriod,
} from "@/lib/insights/compute-insights-statistics";
import {
  INSIGHTS_GOOGLE_MAX_DAYS,
  INSIGHTS_META_MAX_DAYS,
} from "@/lib/insights/compute-insights-statistics";
import { formatReviewRating } from "@/lib/reviews/compute-review-statistics";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { cn } from "@/lib/utils";

type PeriodSelection =
  | { mode: "months"; value: InsightsStatsPeriod }
  | { mode: "days"; value: InsightsStatsDays };

function defaultPeriodForPlatform(platform: InsightsPlatform): PeriodSelection {
  if (platform === "facebook" || platform === "instagram") {
    return { mode: "days", value: INSIGHTS_META_MAX_DAYS };
  }
  if (platform === "google_business") {
    return { mode: "days", value: INSIGHTS_GOOGLE_MAX_DAYS };
  }
  return { mode: "months", value: 3 };
}

function periodOptionsForPlatform(
  platform: InsightsPlatform,
): { selection: PeriodSelection; label: string }[] {
  if (platform === "facebook" || platform === "instagram") {
    return [
      { selection: { mode: "days", value: 7 }, label: "7 Tage" },
      {
        selection: { mode: "days", value: INSIGHTS_META_MAX_DAYS },
        label: `${INSIGHTS_META_MAX_DAYS} Tage`,
      },
    ];
  }
  if (platform === "google_business") {
    return [
      { selection: { mode: "days", value: 30 }, label: "30 Tage" },
      {
        selection: { mode: "days", value: INSIGHTS_GOOGLE_MAX_DAYS },
        label: `${INSIGHTS_GOOGLE_MAX_DAYS} Tage`,
      },
    ];
  }
  return [
    { selection: { mode: "months", value: 3 }, label: "3 Mon." },
    { selection: { mode: "months", value: 6 }, label: "6 Mon." },
    { selection: { mode: "months", value: 12 }, label: "12 Mon." },
  ];
}

function samePeriod(a: PeriodSelection, b: PeriodSelection): boolean {
  return a.mode === b.mode && a.value === b.value;
}

const monthConfig = {
  count: { label: "Anzahl", color: "var(--accent)" },
} satisfies ChartConfig;

const weekdayConfig = {
  count: { label: "Reservierungen", color: "var(--chart-2)" },
} satisfies ChartConfig;

function ChartEmpty({ message }: { message: string }) {
  return (
    <p className="px-6 py-12 text-center text-sm text-muted-foreground">
      {message}
    </p>
  );
}

function DayLineChart({
  title,
  description,
  points,
  seriesName,
  stroke,
}: {
  title: string;
  description: string;
  points: { label: string; value: number }[];
  seriesName: string;
  stroke: string;
}) {
  if (!points.length) return null;
  return (
    <Card className="min-w-0 border-border/50 shadow-card">
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="pl-0">
        <ChartContainer
          config={monthConfig}
          className="aspect-auto h-[260px] w-full min-w-0"
        >
          <LineChart
            accessibilityLayer
            data={points}
            margin={{ left: 4, right: 8, top: 8, bottom: 0 }}
          >
            <CartesianGrid vertical={false} strokeDasharray="4 4" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              className="text-[10px]"
              interval="preserveStartEnd"
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={36}
              className="text-[10px]"
              allowDecimals={false}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line
              type="monotone"
              dataKey="value"
              name={seriesName}
              stroke={stroke}
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

export function InsightsOverviewScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { restaurantId, supabaseEnvOk, ready: workspaceReady } =
    useWorkspaceRestaurantUuid();
  const [platform, setPlatformState] = useState<InsightsPlatform>(() =>
    parseInsightsPlatform(searchParams.get("platform")),
  );
  const [period, setPeriod] = useState<PeriodSelection>(() =>
    defaultPeriodForPlatform(
      parseInsightsPlatform(searchParams.get("platform")),
    ),
  );
  const [data, setData] = useState<InsightsStatisticsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDeferredSkeleton(loading && !data);

  const setPlatform = useCallback(
    (next: InsightsPlatform) => {
      setPlatformState(next);
      setPeriod(defaultPeriodForPlatform(next));
      const params = new URLSearchParams(searchParams.toString());
      if (next === INSIGHTS_PLATFORM_DEFAULT) params.delete("platform");
      else params.set("platform", next);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    const next = parseInsightsPlatform(searchParams.get("platform"));
    setPlatformState(next);
  }, [searchParams]);

  const load = useCallback(async () => {
    if (!restaurantId) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ restaurantId });
      if (period.mode === "days") {
        params.set("daysBack", String(period.value));
      } else {
        params.set("monthsBack", String(period.value));
      }
      const res = await fetch(`/api/insights/statistics?${params}`);
      const body = (await res.json()) as InsightsStatisticsResult & {
        error?: string;
      };
      if (!res.ok) {
        toast.error(body.error ?? "Insights konnten nicht geladen werden.");
        setLoading(false);
        return;
      }
      setData(body);
    } catch {
      toast.error("Netzwerkfehler beim Laden der Insights.");
    }
    setLoading(false);
  }, [restaurantId, period]);

  useEffect(() => {
    void load();
  }, [load]);

  const periodOptions = useMemo(
    () => periodOptionsForPlatform(platform),
    [platform],
  );

  useEffect(() => {
    const allowed = periodOptionsForPlatform(platform);
    if (!allowed.some((opt) => samePeriod(opt.selection, period))) {
      setPeriod(defaultPeriodForPlatform(platform));
    }
  }, [platform, period]);

  const availablePlatforms = useMemo(() => {
    const set = new Set<InsightsPlatform>(["gwada"]);
    if (!data) return set;
    if (data.platforms.google.connected || data.platforms.google.error) {
      set.add("google_business");
    }
    if (data.platforms.facebook.connected || data.platforms.facebook.error) {
      set.add("facebook");
    }
    if (data.platforms.instagram.connected || data.platforms.instagram.error) {
      set.add("instagram");
    }
    if (data.tripadvisor.connected || data.tripadvisor.reviewCount > 0) {
      set.add("tripadvisor");
    }
    if (
      data.lexoffice.connected ||
      (data.lexoffice.stats != null &&
        data.lexoffice.stats.lexofficeDocumentsInPeriod +
          data.lexoffice.stats.openInvoices >
          0)
    ) {
      set.add("lexoffice");
    }
    return set;
  }, [data]);

  useEffect(() => {
    if (!data) return;
    if (!availablePlatforms.has(platform)) {
      setPlatform(INSIGHTS_PLATFORM_DEFAULT);
    }
  }, [data, availablePlatforms, platform, setPlatform]);

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

  if (showSkeleton) {
    return <InsightsOverviewSkeleton />;
  }

  const google = data?.platforms.google;
  const facebook = data?.platforms.facebook;
  const instagram = data?.platforms.instagram;

  return (
    <div className="space-y-6 pb-4">
      <div className="flex flex-col gap-3">
        <InsightsPlatformFilterChips
          value={platform}
          onChange={setPlatform}
          availablePlatforms={availablePlatforms}
          disabled={loading}
        />
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div
            className="flex flex-wrap gap-1 rounded-xl border border-border/50 bg-muted/30 p-1"
            role="group"
            aria-label="Zeitraum"
          >
            {periodOptions.map((opt) => {
              const active = samePeriod(opt.selection, period);
              return (
                <Button
                  key={`${opt.selection.mode}-${opt.selection.value}`}
                  type="button"
                  size="sm"
                  variant={active ? "default" : "ghost"}
                  className={cn(
                    "h-8 rounded-lg px-3 text-xs",
                    active && "shadow-sm",
                  )}
                  onClick={() => setPeriod(opt.selection)}
                >
                  {opt.label}
                </Button>
              );
            })}
          </div>
        </div>
      </div>

      {!data ? (
        <Card className="border-border/50 shadow-card">
          <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
            <MessageSquare className="size-5 shrink-0" aria-hidden />
            Insights konnten nicht geladen werden.
          </CardContent>
        </Card>
      ) : null}

      {data && platform === "gwada" ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              icon={CalendarDays}
              label="Reservierungen"
              value={String(data.reservations.totalInPeriod)}
              hint={`${data.reservations.totalGuests} Gäste · Ø ${data.reservations.avgPartySize ?? "—"} Personen`}
            />
            <KpiCard
              icon={Star}
              label="Gwada-Bewertungen"
              value={String(data.reviews.totalReviews)}
              hint={
                data.reviews.averageRating != null
                  ? `Ø ${formatReviewRating(data.reviews.averageRating)} Sterne`
                  : "Nur native Gwada-Reviews"
              }
            />
            <KpiCard
              icon={MessageCircle}
              label="Gwada-Nachrichten"
              value={String(data.messages.totalMessages)}
              hint={`${data.messages.inboundCount} eingehend · ${data.messages.outboundCount} ausgehend`}
            />
            <KpiCard
              icon={Newspaper}
              label="Gwada-News"
              value={String(data.news.publishedInPeriod)}
              hint="Veröffentlichte Beiträge in Gwada"
            />
          </div>

          <GwadaUsageInsightsPanels usage={data.usage} />

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="min-w-0 border-border/50 shadow-card">
              <CardHeader>
                <CardTitle className="text-lg">Reservierungen pro Monat</CardTitle>
                <CardDescription>
                  Gezählte Buchungen im gewählten Zeitraum.
                </CardDescription>
              </CardHeader>
              <CardContent className="pl-0">
                {data.reservations.byMonth.length === 0 ? (
                  <ChartEmpty message="Keine Reservierungen im Zeitraum." />
                ) : (
                  <ChartContainer
                    config={monthConfig}
                    className="aspect-auto h-[260px] w-full min-w-0"
                  >
                    <LineChart
                      accessibilityLayer
                      data={data.reservations.byMonth}
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
                        className="text-[10px]"
                        allowDecimals={false}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="var(--accent)"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            <Card className="min-w-0 border-border/50 shadow-card">
              <CardHeader>
                <CardTitle className="text-lg">Bewertungen pro Monat</CardTitle>
                <CardDescription>
                  Native Gwada-Bewertungen (ohne Google/Facebook-Cache).
                </CardDescription>
              </CardHeader>
              <CardContent className="pl-0">
                {data.reviews.byMonth.length === 0 ? (
                  <ChartEmpty message="Keine Bewertungen im Zeitraum." />
                ) : (
                  <ChartContainer
                    config={monthConfig}
                    className="aspect-auto h-[260px] w-full min-w-0"
                  >
                    <BarChart
                      accessibilityLayer
                      data={data.reviews.byMonth}
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
                        className="text-[10px]"
                        allowDecimals={false}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="count" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            <Card className="min-w-0 border-border/50 shadow-card">
              <CardHeader>
                <CardTitle className="text-lg">Nachrichten pro Monat</CardTitle>
                <CardDescription>
                  Nachrichten über den Gwada-Kanal.
                </CardDescription>
              </CardHeader>
              <CardContent className="pl-0">
                {data.messages.byMonth.length === 0 ? (
                  <ChartEmpty message="Keine Nachrichten im Zeitraum." />
                ) : (
                  <ChartContainer
                    config={monthConfig}
                    className="aspect-auto h-[260px] w-full min-w-0"
                  >
                    <LineChart
                      accessibilityLayer
                      data={data.messages.byMonth}
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
                        className="text-[10px]"
                        allowDecimals={false}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="var(--chart-1)"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            <Card className="min-w-0 border-border/50 shadow-card">
              <CardHeader>
                <CardTitle className="text-lg">
                  Reservierungen nach Wochentag
                </CardTitle>
                <CardDescription>
                  Wann Gäste am häufigsten reservieren.
                </CardDescription>
              </CardHeader>
              <CardContent className="pl-0">
                {data.reservations.byWeekday.every((d) => d.count === 0) ? (
                  <ChartEmpty message="Keine Daten für Wochentage." />
                ) : (
                  <ChartContainer
                    config={weekdayConfig}
                    className="aspect-auto h-[260px] w-full min-w-0"
                  >
                    <BarChart
                      accessibilityLayer
                      data={data.reservations.byWeekday}
                      margin={{ left: 4, right: 8, top: 8, bottom: 0 }}
                    >
                      <CartesianGrid vertical={false} strokeDasharray="4 4" />
                      <XAxis
                        dataKey="day"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        className="text-[10px]"
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        width={32}
                        className="text-[10px]"
                        allowDecimals={false}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="count" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}

      {data && platform === "google_business" && google ? (
        <>
          <GoogleInsightsPanels google={google} />
          <div className="grid gap-6 lg:grid-cols-2">
            <DayLineChart
              title="Google Aufrufe / Tag"
              description="Suche + Maps (Business Profile Performance)."
              points={
                google.series.find((s) => s.key === "impressions")?.byDay ?? []
              }
              seriesName="Aufrufe"
              stroke="var(--accent)"
            />
            <DayLineChart
              title="Google Interaktionen / Tag"
              description="Anrufe, Website, Routen, Nachrichten, Buchungen, Menü, Bestellungen."
              points={
                google.series.find((s) => s.key === "interactions")?.byDay ?? []
              }
              seriesName="Interaktionen"
              stroke="var(--chart-3)"
            />
          </div>
        </>
      ) : null}

      {data && platform === "facebook" && facebook ? (
        <>
          <FacebookInsightsPanels facebook={facebook} />
          <div className="grid gap-6 lg:grid-cols-2">
            <DayLineChart
              title="Facebook Reichweite / Tag"
              description="page_total_media_view_unique"
              points={
                facebook.series.find((s) => s.key === "reach")?.byDay ?? []
              }
              seriesName="Reichweite"
              stroke="var(--chart-1)"
            />
            <DayLineChart
              title="Facebook Media-Views / Tag"
              description="page_media_view"
              points={
                facebook.series.find((s) => s.key === "media_views")?.byDay ??
                []
              }
              seriesName="Views"
              stroke="var(--chart-2)"
            />
          </div>
        </>
      ) : null}

      {data && platform === "instagram" && instagram ? (
        <>
          <InstagramInsightsPanels instagram={instagram} />
          <div className="grid gap-6 lg:grid-cols-2">
            <DayLineChart
              title="Instagram Reichweite / Tag"
              description={`Account Insights — Zeitraum bis ${INSIGHTS_META_MAX_DAYS} Tage.`}
              points={instagram.series[0]?.byDay ?? []}
              seriesName="Reichweite"
              stroke="var(--chart-2)"
            />
            <DayLineChart
              title="Instagram Views / Tag"
              description="Inhaltsaufrufe (views)."
              points={
                instagram.series.find((s) => s.key === "views")?.byDay ?? []
              }
              seriesName="Views"
              stroke="var(--accent)"
            />
          </div>
        </>
      ) : null}

      {data && platform === "tripadvisor" ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            icon={Star}
            label="Bewertungen"
            value={String(data.tripadvisor.reviewCount)}
            hint={
              data.tripadvisor.averageRating != null
                ? `Ø ${formatReviewRating(data.tripadvisor.averageRating)} Sterne`
                : data.tripadvisor.connected
                  ? "TripAdvisor Sync"
                  : "Nicht verbunden"
            }
          />
        </div>
      ) : null}

      {data && platform === "lexoffice" ? (
        <LexofficeInsightsPanels lexoffice={data.lexoffice} />
      ) : null}
    </div>
  );
}
