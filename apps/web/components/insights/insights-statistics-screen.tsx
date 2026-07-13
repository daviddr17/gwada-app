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
  Eye,
  MessageCircle,
  MessageSquare,
  MousePointerClick,
  Newspaper,
  Star,
  Users,
} from "lucide-react";
import { toast } from "sonner";
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
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import type {
  InsightsStatisticsResult,
  InsightsStatsPeriod,
} from "@/lib/insights/compute-insights-statistics";
import { formatInsightCount } from "@/lib/insights/platform-insights-types";
import { formatReviewRating } from "@/lib/reviews/compute-review-statistics";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { cn } from "@/lib/utils";

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

export function InsightsStatisticsScreen() {
  const { restaurantId, supabaseEnvOk, ready: workspaceReady } =
    useWorkspaceRestaurantUuid();
  const [period, setPeriod] = useState<InsightsStatsPeriod>(12);
  const [data, setData] = useState<InsightsStatisticsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDeferredSkeleton(loading && !data);

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

      {data ? (
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
                  : "Alle Plattformen im Zeitraum"
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

          <section className="space-y-3" aria-label="Plattform-Insights">
            <div>
              <h2 className="text-sm font-semibold tracking-tight">
                Plattform-Insights
              </h2>
              <p className="text-xs text-muted-foreground">
                Live-Kennzahlen von Google Business, Facebook und Instagram.
                Meta liefert Account-Insights typischerweise für die letzten
                ~30 Tage.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <KpiCard
                icon={Eye}
                label="Google Aufrufe"
                value={
                  data.platforms.google.connected
                    ? formatInsightCount(data.platforms.google.impressions)
                    : "—"
                }
                hint={
                  data.platforms.google.connected
                    ? `${formatInsightCount(data.platforms.google.websiteClicks)} Website · ${formatInsightCount(data.platforms.google.callClicks)} Anrufe`
                    : "Nicht verbunden"
                }
              />
              <KpiCard
                icon={Users}
                label="Facebook Reichweite"
                value={
                  data.platforms.facebook.connected
                    ? formatInsightCount(data.platforms.facebook.reach)
                    : "—"
                }
                hint={
                  data.platforms.facebook.needsReconnect
                    ? "Scope „Seiten-Statistiken“ fehlt — unter Integrationen erneut verbinden"
                    : data.platforms.facebook.connected
                      ? `${formatInsightCount(data.platforms.facebook.impressions)} Impressionen · ${formatInsightCount(data.platforms.facebook.postEngagements)} Interaktionen`
                      : "Nicht verbunden"
                }
              />
              <KpiCard
                icon={MousePointerClick}
                label="Instagram Reichweite"
                value={
                  data.platforms.instagram.connected
                    ? formatInsightCount(data.platforms.instagram.reach)
                    : "—"
                }
                hint={
                  data.platforms.instagram.connected
                    ? `${formatInsightCount(data.platforms.instagram.views)} Views · ${formatInsightCount(data.platforms.instagram.totalInteractions)} Interaktionen`
                    : "Nicht verbunden"
                }
              />
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            {data.platforms.google.series[0]?.byDay.length ? (
              <Card className="min-w-0 border-border/50 shadow-card">
                <CardHeader>
                  <CardTitle className="text-lg">Google Aufrufe / Tag</CardTitle>
                  <CardDescription>
                    Maps- und Suchimpressionen aus Business Profile Performance.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pl-0">
                  <ChartContainer
                    config={monthConfig}
                    className="aspect-auto h-[260px] w-full min-w-0"
                  >
                    <LineChart
                      accessibilityLayer
                      data={data.platforms.google.series[0].byDay}
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
                        name="Aufrufe"
                        stroke="var(--accent)"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            ) : null}

            {data.platforms.facebook.series[0]?.byDay.length ? (
              <Card className="min-w-0 border-border/50 shadow-card">
                <CardHeader>
                  <CardTitle className="text-lg">
                    Facebook Impressionen / Tag
                  </CardTitle>
                  <CardDescription>
                    Page Insights (page_impressions).
                  </CardDescription>
                </CardHeader>
                <CardContent className="pl-0">
                  <ChartContainer
                    config={monthConfig}
                    className="aspect-auto h-[260px] w-full min-w-0"
                  >
                    <LineChart
                      accessibilityLayer
                      data={data.platforms.facebook.series[0].byDay}
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
                        name="Impressionen"
                        stroke="var(--chart-1)"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            ) : null}

            {data.platforms.instagram.series[0]?.byDay.length ? (
              <Card className="min-w-0 border-border/50 shadow-card">
                <CardHeader>
                  <CardTitle className="text-lg">
                    Instagram Reichweite / Tag
                  </CardTitle>
                  <CardDescription>
                    Account Insights (reach) — i. d. R. letzte ~30 Tage.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pl-0">
                  <ChartContainer
                    config={monthConfig}
                    className="aspect-auto h-[260px] w-full min-w-0"
                  >
                    <LineChart
                      accessibilityLayer
                      data={data.platforms.instagram.series[0].byDay}
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
                        name="Reichweite"
                        stroke="var(--chart-2)"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            ) : null}

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
                  Gwada und verbundene Plattformen zusammen.
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
                <CardTitle className="text-lg">Reservierungen nach Wochentag</CardTitle>
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
                <CardDescription>Verteilung im gewählten Zeitraum.</CardDescription>
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
      ) : (
        <Card className="border-border/50 shadow-card">
          <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
            <MessageSquare className="size-5 shrink-0" aria-hidden />
            Statistiken konnten nicht geladen werden.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
