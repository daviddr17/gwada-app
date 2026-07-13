"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  MessageCircle,
  MessageSquare,
  Newspaper,
  Star,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { InsightsPlatformFilterChips } from "@/components/insights/insights-platform-filter-chips";
import {
  FacebookInsightsPanels,
  GoogleInsightsPanels,
  InstagramInsightsPanels,
} from "@/components/insights/insights-platform-panels";
import { InsightsStatisticsSkeleton } from "@/components/insights/insights-statistics-skeleton";
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
  INSIGHTS_PLATFORM_LABELS,
  parseInsightsPlatform,
  type InsightsPlatform,
} from "@/lib/constants/insights-platforms";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import type {
  InsightsStatisticsResult,
  InsightsStatsPeriod,
} from "@/lib/insights/compute-insights-statistics";
import { formatReviewRating } from "@/lib/reviews/compute-review-statistics";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { APP_ROUTES } from "@/lib/navigation/app-routes";
import { cn } from "@/lib/utils";
import Link from "next/link";

const monthConfig = {
  count: { label: "Anzahl", color: "var(--accent)" },
} satisfies ChartConfig;

const platformConfig = {
  count: { label: "Anzahl", color: "var(--chart-3)" },
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

export function InsightsStatisticsScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { restaurantId, supabaseEnvOk, ready: workspaceReady } =
    useWorkspaceRestaurantUuid();
  const [platform, setPlatformState] = useState<InsightsPlatform>(() =>
    parseInsightsPlatform(searchParams.get("platform")),
  );
  const [period, setPeriod] = useState<InsightsStatsPeriod>(12);
  const [data, setData] = useState<InsightsStatisticsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDeferredSkeleton(loading && !data);

  const setPlatform = useCallback(
    (next: InsightsPlatform) => {
      setPlatformState(next);
      const params = new URLSearchParams(searchParams.toString());
      if (next === INSIGHTS_PLATFORM_DEFAULT) params.delete("platform");
      else params.set("platform", next);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    setPlatformState(parseInsightsPlatform(searchParams.get("platform")));
  }, [searchParams]);

  const load = useCallback(async () => {
    if (!restaurantId) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({
        restaurantId,
        monthsBack: String(period),
      });
      const res = await fetch(`/api/insights/statistics?${params}`);
      const body = (await res.json()) as InsightsStatisticsResult & {
        error?: string;
      };
      if (!res.ok) {
        toast.error(body.error ?? "Statistiken konnten nicht geladen werden.");
        setLoading(false);
        return;
      }
      setData(body);
    } catch {
      toast.error("Netzwerkfehler beim Laden der Statistiken.");
    }
    setLoading(false);
  }, [restaurantId, period]);

  useEffect(() => {
    void load();
  }, [load]);

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
    if (data.reviews.byPlatform.some((p) => /tripadvisor/i.test(p.label))) {
      set.add("tripadvisor");
    }
    return set;
  }, [data]);

  useEffect(() => {
    if (!data) return;
    if (!availablePlatforms.has(platform)) {
      setPlatform(INSIGHTS_PLATFORM_DEFAULT);
    }
  }, [data, availablePlatforms, platform, setPlatform]);

  const reviewPlatformChart = useMemo(
    () =>
      data?.reviews.byPlatform.map((p) => ({
        name: p.label,
        count: p.count,
        fill: p.color,
      })) ?? [],
    [data?.reviews.byPlatform],
  );

  const messagePlatformChart = useMemo(
    () =>
      data?.messages.byPlatform.map((p) => ({
        name: p.label,
        count: p.count,
        fill: p.color,
      })) ?? [],
    [data?.messages.byPlatform],
  );

  const tripReviews = useMemo(
    () =>
      data?.reviews.byPlatform.find((p) => /tripadvisor/i.test(p.label)) ??
      null,
    [data?.reviews.byPlatform],
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

  if (showSkeleton) {
    return <InsightsStatisticsSkeleton />;
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
      </div>

      <p className="text-xs text-muted-foreground">
        {INSIGHTS_PLATFORM_LABELS[platform]}-Statistiken
        {platform === "google_business"
          ? " — Google Performance i. d. R. letzte ~90 Tage."
          : platform === "facebook" || platform === "instagram"
            ? " — Meta-Insights meist letzte ~30 Tage."
            : null}{" "}
        <Link
          href={
            platform === INSIGHTS_PLATFORM_DEFAULT
              ? APP_ROUTES.insights.overview
              : `${APP_ROUTES.insights.overview}?platform=${platform}`
          }
          className="font-medium text-accent hover:underline"
        >
          Übersicht
        </Link>
      </p>

      {!data ? (
        <Card className="border-border/50 shadow-card">
          <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
            <MessageSquare className="size-5 shrink-0" aria-hidden />
            Statistiken konnten nicht geladen werden.
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
              label="Bewertungen"
              value={String(data.reviews.totalReviews)}
              hint={
                data.reviews.averageRating != null
                  ? `Ø ${formatReviewRating(data.reviews.averageRating)} Sterne`
                  : "Im Zeitraum"
              }
            />
            <KpiCard
              icon={MessageCircle}
              label="Nachrichten"
              value={String(data.messages.totalMessages)}
              hint={`${data.messages.inboundCount} eingehend · ${data.messages.outboundCount} ausgehend`}
            />
            <KpiCard
              icon={Newspaper}
              label="News & Engagement"
              value={String(data.news.publishedInPeriod)}
              hint={`${data.news.engagementLikes} Likes · ${data.news.engagementComments} Kommentare`}
            />
          </div>

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
                  Alle in Gwada gesammelten Bewertungen.
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
                  Gespeicherte Kontakt-Nachrichten aller Kanäle.
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

            <Card className="min-w-0 border-border/50 shadow-card">
              <CardHeader>
                <CardTitle className="text-lg">Bewertungen nach Plattform</CardTitle>
                <CardDescription>
                  Herkunft der in Gwada gespeicherten Reviews.
                </CardDescription>
              </CardHeader>
              <CardContent className="pl-0">
                {reviewPlatformChart.length === 0 ? (
                  <ChartEmpty message="Keine Bewertungen nach Plattform." />
                ) : (
                  <ChartContainer
                    config={platformConfig}
                    className="aspect-auto h-[260px] w-full min-w-0"
                  >
                    <BarChart
                      accessibilityLayer
                      data={reviewPlatformChart}
                      layout="vertical"
                      margin={{ left: 4, right: 8, top: 8, bottom: 0 }}
                    >
                      <CartesianGrid horizontal={false} strokeDasharray="4 4" />
                      <XAxis type="number" hide />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tickLine={false}
                        axisLine={false}
                        width={72}
                        className="text-[10px]"
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                        {reviewPlatformChart.map((entry) => (
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
                <CardTitle className="text-lg">Nachrichten nach Kanal</CardTitle>
                <CardDescription>
                  WhatsApp, E-Mail, Social und Gwada.
                </CardDescription>
              </CardHeader>
              <CardContent className="pl-0">
                {messagePlatformChart.length === 0 ? (
                  <ChartEmpty message="Keine Nachrichten nach Kanal." />
                ) : (
                  <ChartContainer
                    config={platformConfig}
                    className="aspect-auto h-[260px] w-full min-w-0"
                  >
                    <BarChart
                      accessibilityLayer
                      data={messagePlatformChart}
                      layout="vertical"
                      margin={{ left: 4, right: 8, top: 8, bottom: 0 }}
                    >
                      <CartesianGrid horizontal={false} strokeDasharray="4 4" />
                      <XAxis type="number" hide />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tickLine={false}
                        axisLine={false}
                        width={72}
                        className="text-[10px]"
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                        {messagePlatformChart.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Bar>
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
              description="Account Insights — i. d. R. letzte ~30 Tage."
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
            value={String(tripReviews?.count ?? 0)}
            hint={
              tripReviews?.average != null
                ? `Ø ${formatReviewRating(tripReviews.average)} Sterne`
                : "TripAdvisor im Sync"
            }
          />
        </div>
      ) : null}
    </div>
  );
}
