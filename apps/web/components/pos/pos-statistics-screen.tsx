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
import {
  LIST_PAGE_SIZE_DEFAULT,
  clampListPage,
  totalPagesFromCount,
} from "@/lib/constants/list-pagination";
import { moduleDataTableHeadRowClassName } from "@/lib/ui/module-data-table";
import {
  ModuleDataTableFrame,
  ModulePaginatedDataTable,
} from "@/lib/ui/module-paginated-data-table";
import {
  ModuleTableSortHeader,
  type ModuleTableSortDir,
} from "@/lib/ui/module-table-sort-header";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type ItemSortKey = "quantity" | "name" | "revenue" | "orders";

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
  const [itemSearch, setItemSearch] = useState("");
  const [itemPage, setItemPage] = useState(1);
  const [itemSortKey, setItemSortKey] = useState<ItemSortKey>("quantity");
  const [itemSortDir, setItemSortDir] = useState<ModuleTableSortDir>("desc");
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
    const detailed = stats.byPaymentMethods ?? [];
    if (detailed.length > 0) {
      const palette = [
        "var(--color-cash)",
        "var(--color-card)",
        "var(--color-voucher)",
        "var(--color-other)",
        "var(--chart-5)",
      ];
      return detailed
        .filter((r) => r.cents > 0)
        .map((r, i) => ({
          name: r.label,
          value: r.cents / 100,
          fill: palette[i % palette.length]!,
        }));
    }
    return [
      {
        name: "Bar",
        value: stats.byMethod.cashCents / 100,
        fill: "var(--color-cash)",
      },
      {
        name: "Unbar",
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

  const toggleItemSort = (key: ItemSortKey) => {
    if (itemSortKey !== key) {
      setItemSortKey(key);
      setItemSortDir(key === "name" ? "asc" : "desc");
      return;
    }
    setItemSortDir((d) => (d === "asc" ? "desc" : "asc"));
  };

  const sortedItems = useMemo(() => {
    const q = itemSearch.trim().toLowerCase();
    let rows = stats?.byItem ?? [];
    if (q) {
      rows = rows.filter((r) => r.name.toLowerCase().includes(q));
    }
    const mul = itemSortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      switch (itemSortKey) {
        case "name":
          return a.name.localeCompare(b.name, "de") * mul;
        case "revenue":
          return (a.lineTotalCents - b.lineTotalCents) * mul;
        case "orders":
          return (a.orderCount - b.orderCount) * mul;
        case "quantity":
        default:
          return (a.quantity - b.quantity) * mul;
      }
    });
  }, [stats?.byItem, itemSearch, itemSortKey, itemSortDir]);

  const itemTotalPages = totalPagesFromCount(
    sortedItems.length,
    LIST_PAGE_SIZE_DEFAULT,
  );
  const itemCurrentPage = clampListPage(itemPage, itemTotalPages);
  const paginatedItems = useMemo(() => {
    const start = (itemCurrentPage - 1) * LIST_PAGE_SIZE_DEFAULT;
    return sortedItems.slice(start, start + LIST_PAGE_SIZE_DEFAULT);
  }, [sortedItems, itemCurrentPage]);

  useEffect(() => {
    setItemPage(1);
  }, [fromYmd, toYmd, itemSearch, itemSortKey, itemSortDir]);

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
              label="Unbar"
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
              label="Weitere"
              value={stats ? formatCents(stats.byMethod.otherCents) : "—"}
              hint={`${stats?.byMethod.otherCount ?? 0} Zahlungen`}
              icon={Receipt}
            />
          </div>

          {stats?.byPaymentMethods && stats.byPaymentMethods.length > 0 ? (
            <Card className="border-border/50 shadow-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">
                  Nach Zahlungsart
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {stats.byPaymentMethods.map((row) => (
                  <div
                    key={row.id ?? row.label}
                    className="flex items-baseline justify-between gap-3 rounded-lg border border-border/40 px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 truncate font-medium">
                      {row.label}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {formatCents(row.cents)} · {row.count}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

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

          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-base font-semibold">Artikel-Auswertung</h2>
                <p className="text-sm text-muted-foreground">
                  Wie oft welcher Artikel im Zeitraum verkauft wurde (bezahlte
                  Bestellungen).
                </p>
              </div>
              <Input
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                placeholder="Artikel suchen…"
                className="h-10 sm:max-w-xs"
              />
            </div>
            {sortedItems.length === 0 ? (
              <Card className="border-border/50 shadow-card">
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  Keine verkauften Artikel im Zeitraum.
                </CardContent>
              </Card>
            ) : (
              <ModulePaginatedDataTable
                shown={paginatedItems.length}
                totalCount={sortedItems.length}
                itemLabel="Artikel"
                page={itemCurrentPage}
                totalPages={itemTotalPages}
                canPrevious={itemCurrentPage > 1}
                canNext={itemCurrentPage < itemTotalPages}
                onPrevious={() => setItemPage((p) => Math.max(1, p - 1))}
                onNext={() =>
                  setItemPage((p) => Math.min(itemTotalPages, p + 1))
                }
              >
                <table className="w-full text-sm">
                  <thead>
                    <tr className={moduleDataTableHeadRowClassName}>
                      <ModuleTableSortHeader
                        label="Artikel"
                        sortKey="name"
                        activeKey={itemSortKey}
                        dir={itemSortDir}
                        onSort={toggleItemSort}
                      />
                      <ModuleTableSortHeader
                        label="Menge"
                        sortKey="quantity"
                        activeKey={itemSortKey}
                        dir={itemSortDir}
                        onSort={toggleItemSort}
                        align="right"
                      />
                      <ModuleTableSortHeader
                        label="Umsatz"
                        sortKey="revenue"
                        activeKey={itemSortKey}
                        dir={itemSortDir}
                        onSort={toggleItemSort}
                        align="right"
                      />
                      <ModuleTableSortHeader
                        label="Bons"
                        sortKey="orders"
                        activeKey={itemSortKey}
                        dir={itemSortDir}
                        onSort={toggleItemSort}
                        align="right"
                      />
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedItems.map((item) => (
                      <tr
                        key={item.menuItemId ?? item.name}
                        className="border-t border-border/40"
                      >
                        <td className="px-3 py-2.5 font-medium">{item.name}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {item.quantity}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {formatCents(item.lineTotalCents)}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                          {item.orderCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ModulePaginatedDataTable>
            )}
          </div>

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
