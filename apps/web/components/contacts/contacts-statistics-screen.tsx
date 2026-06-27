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
  Mail,
  MessageSquare,
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
  computeContactStatistics,
  type ContactStatsPeriod,
} from "@/lib/contacts/compute-contact-statistics";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { fetchContactStatisticsBundle } from "@/lib/supabase/contact-messages-analytics-db";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { cn } from "@/lib/utils";

const monthConfig = {
  count: { label: "Nachrichten", color: "var(--accent)" },
} satisfies ChartConfig;

const weekdayConfig = {
  count: { label: "Nachrichten", color: "var(--chart-2)" },
} satisfies ChartConfig;

const hourConfig = {
  count: { label: "Eingehend", color: "var(--chart-1)" },
} satisfies ChartConfig;

const platformConfig = {
  count: { label: "Nachrichten", color: "var(--chart-3)" },
} satisfies ChartConfig;

const directionConfig = {
  count: { label: "Nachrichten", color: "var(--chart-4)" },
} satisfies ChartConfig;

const topContactsConfig = {
  count: { label: "Nachrichten", color: "var(--chart-5)" },
} satisfies ChartConfig;

const reachConfig = {
  count: { label: "Kontakte", color: "var(--chart-1)" },
} satisfies ChartConfig;

function ChartEmpty({ message }: { message: string }) {
  return (
    <p className="px-6 py-12 text-center text-sm text-muted-foreground">
      {message}
    </p>
  );
}

export function ContactsStatisticsScreen() {
  const { restaurantId, supabaseEnvOk, ready: workspaceReady } =
    useWorkspaceRestaurantUuid();
  const [period, setPeriod] = useState<ContactStatsPeriod>(12);
  const [bundle, setBundle] = useState<Awaited<
    ReturnType<typeof fetchContactStatisticsBundle>
  >["data"]>(null);
  const [totalUnread, setTotalUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDeferredSkeleton(loading);

  useEffect(() => {
    if (!restaurantId) return;
    let cancel = false;
    setLoading(true);
    void (async () => {
      const [statsRes, unreadRes] = await Promise.all([
        fetchContactStatisticsBundle({
          restaurantId,
          monthsBack: period,
        }),
        fetch(
          `/api/contact-messages/unread-summary?restaurantId=${encodeURIComponent(restaurantId)}&scope=dashboard`,
        )
          .then(async (res) => {
            if (!res.ok) return 0;
            const json = (await res.json()) as {
              data?: { total_unread?: number };
            };
            return json.data?.total_unread ?? 0;
          })
          .catch(() => 0),
      ]);
      if (cancel) return;
      setLoading(false);
      if (statsRes.error) toast.error(statsRes.error);
      else setBundle(statsRes.data);
      setTotalUnread(unreadRes);
    })();
    return () => {
      cancel = true;
    };
  }, [restaurantId, period]);

  const stats = useMemo(() => {
    if (!bundle) return null;
    return computeContactStatistics({
      messages: bundle.messages,
      contacts: bundle.contacts,
      periodStart: bundle.periodStart,
      periodEnd: bundle.periodEnd,
      totalUnread,
    });
  }, [bundle, totalUnread]);

  const platformChartData = useMemo(
    () =>
      stats?.byPlatform.map((p) => ({
        name: p.label,
        count: p.count,
        fill: p.color,
      })) ?? [],
    [stats?.byPlatform],
  );

  const directionChartData = useMemo(
    () =>
      stats?.byDirection.map((d) => ({
        name: d.label,
        count: d.count,
        fill: d.color,
      })) ?? [],
    [stats?.byDirection],
  );

  const reachChartData = useMemo(
    () =>
      stats
        ? [
            { name: "E-Mail", count: stats.contactsWithEmail },
            { name: "Telefon", count: stats.contactsWithPhone },
            { name: "Messenger", count: stats.contactsWithMessaging },
          ].filter((row) => row.count > 0)
        : [],
    [stats],
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
              icon={MessageSquare}
              label="Nachrichten"
              value={String(stats.totalMessages)}
              hint={
                stats.inboundSharePercent != null
                  ? `${stats.inboundSharePercent}% eingehend`
                  : "Im gewählten Zeitraum"
              }
            />
            <KpiCard
              icon={Mail}
              label="Eingehend / Ausgehend"
              value={`${stats.inboundCount} / ${stats.outboundCount}`}
              hint="Gespeicherte Nachrichten in der DB"
            />
            <KpiCard
              icon={Users}
              label="Aktive Kontakte"
              value={String(stats.activeContacts)}
              hint={`${stats.avgMessagesPerActiveContact ?? 0} Ø Nachrichten`}
            />
            <KpiCard
              icon={MessageSquare}
              label="Ungelesen"
              value={String(stats.totalUnread)}
              hint="Aktueller Posteingang (alle Kanäle)"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              icon={Users}
              label="Kontakte gesamt"
              value={String(stats.totalContacts)}
              hint={`${stats.newContactsInPeriod} neu im Zeitraum`}
            />
            <KpiCard
              icon={CalendarDays}
              label="Mit Reservierung"
              value={String(stats.contactsWithReservations)}
              hint={`${stats.reservationLinkedMessages} Nachrichten verknüpft`}
            />
            <KpiCard
              icon={MessageSquare}
              label="Beliebtester Kanal"
              value={stats.topPlatform ?? "—"}
              hint="Nachrichten im Zeitraum"
            />
            <KpiCard
              icon={CalendarDays}
              label="Beliebtester Tag"
              value={stats.topWeekday ?? "—"}
              hint="Wochentag nach Nachrichtendatum"
            />
          </div>
        </>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="min-w-0 border-border/50 shadow-card">
          <CardHeader>
            <CardTitle className="text-lg">Verlauf pro Monat</CardTitle>
            <CardDescription>
              Anzahl gespeicherter Nachrichten im Zeitraum.
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            {showSkeleton ? (
              <Skeleton className="mx-6 h-[240px] w-auto rounded-xl" />
            ) : !stats || stats.byMonth.length === 0 ? (
              <ChartEmpty message="Noch keine Nachrichten im gewählten Zeitraum." />
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
            <CardTitle className="text-lg">Nach Kanal</CardTitle>
            <CardDescription>
              WhatsApp, E-Mail, Gwada und soziale Kanäle.
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            {showSkeleton ? (
              <Skeleton className="mx-6 h-[240px] w-auto rounded-xl" />
            ) : !stats || platformChartData.length === 0 ? (
              <ChartEmpty message="Noch keine Nachrichten im gewählten Zeitraum." />
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
            <CardTitle className="text-lg">Richtung</CardTitle>
            <CardDescription>
              Eingehende und ausgehende Nachrichten im Zeitraum.
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            {showSkeleton ? (
              <Skeleton className="mx-6 h-[240px] w-auto rounded-xl" />
            ) : !stats || stats.totalMessages === 0 ? (
              <ChartEmpty message="Noch keine Nachrichten im gewählten Zeitraum." />
            ) : (
              <ChartContainer
                config={directionConfig}
                className="aspect-auto h-[260px] w-full min-w-0"
              >
                <BarChart
                  accessibilityLayer
                  data={directionChartData}
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
                    {directionChartData.map((entry) => (
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
            <CardTitle className="text-lg">Wochentage</CardTitle>
            <CardDescription>
              Wann Nachrichten eingehen oder versendet werden.
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            {showSkeleton ? (
              <Skeleton className="mx-6 h-[240px] w-auto rounded-xl" />
            ) : !stats || stats.totalMessages === 0 ? (
              <ChartEmpty message="Noch keine Nachrichten im gewählten Zeitraum." />
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
        <Card className="min-w-0 border-border/50 shadow-card lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Erreichbarkeit</CardTitle>
            <CardDescription>
              Kontakte mit E-Mail, Telefon oder Messenger-ID.
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            {showSkeleton ? (
              <Skeleton className="mx-6 h-[280px] w-auto rounded-xl" />
            ) : !stats || reachChartData.length === 0 ? (
              <ChartEmpty message="Noch keine Kontaktdaten hinterlegt." />
            ) : (
              <ChartContainer
                config={reachConfig}
                className="aspect-auto h-[280px] w-full min-w-0"
              >
                <BarChart
                  accessibilityLayer
                  data={reachChartData}
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
                    width={88}
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
            <CardTitle className="text-lg">Top Kontakte</CardTitle>
            <CardDescription>
              Meiste Nachrichten pro Kontakt im Zeitraum.
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            {showSkeleton ? (
              <Skeleton className="mx-6 h-[280px] w-auto rounded-xl" />
            ) : !stats || stats.topContacts.length === 0 ? (
              <ChartEmpty message="Noch keine Nachrichten erfasst." />
            ) : (
              <ChartContainer
                config={topContactsConfig}
                className="aspect-auto h-[280px] w-full min-w-0"
              >
                <BarChart
                  accessibilityLayer
                  data={stats.topContacts}
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
                    className="tabular-nums"
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

      <Card className="min-w-0 border-border/50 shadow-card">
        <CardHeader>
          <CardTitle className="text-lg">Uhrzeiten (eingehend)</CardTitle>
          <CardDescription>
            Wann Gäste am häufigsten schreiben — nach Empfangszeit.
          </CardDescription>
        </CardHeader>
        <CardContent className="pl-0">
          {showSkeleton ? (
            <Skeleton className="mx-6 h-[240px] w-auto rounded-xl" />
          ) : !stats || stats.inboundCount === 0 ? (
            <ChartEmpty message="Noch keine eingehenden Nachrichten im Zeitraum." />
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
    </div>
  );
}
