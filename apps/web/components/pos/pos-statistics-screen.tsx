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
  Banknote,
  BarChart3,
  CreditCard,
  HandCoins,
  Receipt,
  Ticket,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { DatePickerField } from "@/components/ui/date-picker";
import { KpiCard } from "@/components/ui/kpi-card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import {
  fetchPosStatistics,
  posApiErrorLabel,
  type PosWebStatisticsDto,
} from "@/lib/pos/pos-web-api-client";
import { moduleDataTableHeadRowClassName } from "@/lib/ui/module-data-table";
import { ModuleDataTableFrame } from "@/lib/ui/module-paginated-data-table";
import { cn } from "@/lib/utils";

type PeriodPreset = "today" | "7" | "30" | "custom";

function formatCents(cents: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function todayYmdLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function shiftYmdLocal(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d + deltaDays);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function formatDayLabel(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
  });
}

const revenueConfig = {
  gross: { label: "Brutto", color: "var(--accent)" },
  tip: { label: "Trinkgeld", color: "var(--chart-2)" },
} satisfies ChartConfig;

const tenderConfig = {
  cash: { label: "Bar", color: "var(--chart-2)" },
  card: { label: "Karte", color: "var(--chart-1)" },
  voucher: { label: "Gutschein", color: "var(--chart-4)" },
  other: { label: "Sonstig", color: "var(--chart-3)" },
} satisfies ChartConfig;

export function PosStatisticsScreen() {
  const { restaurantId, ready } = useWorkspaceRestaurantUuid();
  const today = useMemo(() => todayYmdLocal(), []);
  const [preset, setPreset] = useState<PeriodPreset>("today");
  const [fromYmd, setFromYmd] = useState(today);
  const [toYmd, setToYmd] = useState(today);
  const [stats, setStats] = useState<PosWebStatisticsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDeferredSkeleton(!ready || loading);

  const applyPreset = (next: PeriodPreset) => {
    setPreset(next);
    if (next === "today") {
      setFromYmd(today);
      setToYmd(today);
    } else if (next === "7") {
      setFromYmd(shiftYmdLocal(today, -6));
      setToYmd(today);
    } else if (next === "30") {
      setFromYmd(shiftYmdLocal(today, -29));
      setToYmd(today);
    }
  };

  const rangeInvalid = fromYmd > toYmd;

  const load = useCallback(async () => {
    if (!restaurantId || rangeInvalid) {
      setStats(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await fetchPosStatistics(restaurantId, fromYmd, toYmd);
      if (!result.ok) {
        toast.error(posApiErrorLabel(result.error));
        setStats(null);
        return;
      }
      setStats(result.data);
    } finally {
      setLoading(false);
    }
  }, [restaurantId, fromYmd, toYmd, rangeInvalid]);

  useEffect(() => {
    void load();
  }, [load]);

  const dayChartData = useMemo(
    () =>
      (stats?.byDay ?? []).map((d) => ({
        label: formatDayLabel(d.ymd),
        gross: d.grossCents / 100,
        tip: d.tipCents / 100,
      })),
    [stats?.byDay],
  );

  const tenderChartData = useMemo(() => {
    if (!stats) return [];
    return [
      {
        name: "Bar",
        value: stats.byMethod.cashCents / 100,
        fill: "var(--color-cash)",
      },
      {
        name: "Karte",
        value: stats.byMethod.cardCents / 100,
        fill: "var(--color-card)",
      },
      {
        name: "Gutschein",
        value: (stats.byMethod.voucherCents ?? 0) / 100,
        fill: "var(--color-voucher)",
      },
      {
        name: "Sonstig",
        value: stats.byMethod.otherCents / 100,
        fill: "var(--color-other)",
      },
    ].filter((r) => r.value > 0);
  }, [stats]);

  if (!ready) {
    return <WorkspaceRestaurantResolvePlaceholder className="py-10" />;
  }
  if (!restaurantId) {
    return <WorkspaceRestaurantMissingMessage className="py-10" />;
  }

  return (
    <div className="space-y-6 pt-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div
          className="flex flex-wrap gap-1 rounded-xl border border-border/50 bg-muted/30 p-1"
          role="group"
          aria-label="Zeitraum"
        >
          {(
            [
              ["today", "Heute"],
              ["7", "7 Tage"],
              ["30", "30 Tage"],
              ["custom", "Zeitraum"],
            ] as const
          ).map(([key, label]) => (
            <Button
              key={key}
              type="button"
              size="sm"
              variant={preset === key ? "default" : "ghost"}
              className={cn(
                "h-8 rounded-lg px-3 text-xs",
                preset === key && "shadow-sm",
              )}
              onClick={() => applyPreset(key)}
            >
              {label}
            </Button>
          ))}
        </div>
        {preset === "custom" ? (
          <div className="grid w-full gap-3 sm:max-w-md sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pos-stats-from" className="text-xs">
                Von
              </Label>
              <DatePickerField
                id="pos-stats-from"
                value={fromYmd}
                onChange={(v) => setFromYmd(v ?? fromYmd)}
                fullWidth
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pos-stats-to" className="text-xs">
                Bis
              </Label>
              <DatePickerField
                id="pos-stats-to"
                value={toYmd}
                onChange={(v) => setToYmd(v ?? toYmd)}
                minYmd={fromYmd}
                fullWidth
              />
            </div>
          </div>
        ) : null}
      </div>

      {rangeInvalid ? (
        <p className="text-sm text-destructive">
          Das Enddatum muss am oder nach dem Startdatum liegen.
        </p>
      ) : null}

      {showSkeleton ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Brutto"
              value={stats ? formatCents(stats.grossCents) : "—"}
              hint={`${stats?.paymentCount ?? 0} Zahlungen`}
              icon={Receipt}
            />
            <KpiCard
              label="Netto"
              value={stats ? formatCents(stats.netCents) : "—"}
              hint="ohne Trinkgeld"
              icon={BarChart3}
            />
            <KpiCard
              label="Trinkgeld"
              value={stats ? formatCents(stats.tipCents) : "—"}
              hint={
                stats && stats.refundedCount > 0
                  ? `${stats.refundedCount} Stornos`
                  : "im Zeitraum"
              }
              icon={HandCoins}
            />
            <KpiCard
              label="Ø Bon"
              value={
                !stats || stats.paymentCount === 0
                  ? "—"
                  : formatCents(stats.avgBonCents)
              }
              hint="Brutto / Zahlung"
              icon={CreditCard}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Bar"
              value={stats ? formatCents(stats.byMethod.cashCents) : "—"}
              hint={`${stats?.byMethod.cashCount ?? 0} Zahlungen`}
              icon={Banknote}
            />
            <KpiCard
              label="Karte"
              value={stats ? formatCents(stats.byMethod.cardCents) : "—"}
              hint={`${stats?.byMethod.cardCount ?? 0} Zahlungen`}
              icon={CreditCard}
            />
            <KpiCard
              label="Gutschein"
              value={
                stats ? formatCents(stats.byMethod.voucherCents ?? 0) : "—"
              }
              hint={`${stats?.byMethod.voucherCount ?? 0} Zahlungen`}
              icon={Ticket}
            />
            <KpiCard
              label="Sonstig"
              value={stats ? formatCents(stats.byMethod.otherCents) : "—"}
              hint={`${stats?.byMethod.otherCount ?? 0} Zahlungen`}
              icon={Receipt}
            />
          </div>

          <Card className="border-border/50 shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">
                Umsatz nach Tag
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!stats || dayChartData.every((d) => d.gross === 0) ? (
                <p className="px-2 py-12 text-center text-sm text-muted-foreground">
                  Keine Umsätze im gewählten Zeitraum.
                </p>
              ) : (
                <ChartContainer config={revenueConfig} className="h-64 w-full">
                  <LineChart data={dayChartData} accessibilityLayer>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      width={48}
                      tickFormatter={(v) => `${v}`}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line
                      type="monotone"
                      dataKey="gross"
                      stroke="var(--color-gross)"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="tip"
                      stroke="var(--color-tip)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">
                Zahlungsmittel
              </CardTitle>
            </CardHeader>
            <CardContent>
              {tenderChartData.length === 0 ? (
                <p className="px-2 py-12 text-center text-sm text-muted-foreground">
                  Noch keine Zahlungsmittel-Verteilung.
                </p>
              ) : (
                <ChartContainer config={tenderConfig} className="h-56 w-full">
                  <BarChart data={tenderChartData} accessibilityLayer>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} width={48} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="value" radius={8}>
                      {tenderChartData.map((row) => (
                        <Cell key={row.name} fill={row.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">
                Z-Abschlüsse
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 sm:px-6 sm:pb-6">
              {!stats || stats.zSessions.length === 0 ? (
                <p className="px-6 py-10 text-center text-sm text-muted-foreground sm:px-0">
                  Keine Z-Abschlüsse im Zeitraum.
                </p>
              ) : (
                <ModuleDataTableFrame>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className={moduleDataTableHeadRowClassName}>
                        <th className="px-3 py-2 text-left font-medium">
                          Z-Nr.
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          Geschlossen
                        </th>
                        <th className="px-3 py-2 text-right font-medium">
                          Endbestand
                        </th>
                        <th className="px-3 py-2 text-right font-medium">
                          Differenz
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.zSessions.map((session) => (
                        <tr
                          key={session.id}
                          className="border-t border-border/40"
                        >
                          <td className="px-3 py-2.5 tabular-nums font-medium">
                            {session.zNr ?? "—"}
                          </td>
                          <td className="px-3 py-2.5 text-muted-foreground">
                            {formatDateTime(session.closedAt)}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            {session.closingCashCents == null
                              ? "—"
                              : formatCents(session.closingCashCents)}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            {session.cashDifferenceCents == null
                              ? "—"
                              : formatCents(session.cashDifferenceCents)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ModuleDataTableFrame>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
