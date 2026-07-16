"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, CreditCard, Receipt } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import {
  fetchPosPaidTodayOrders,
  type PosWebOrderDto,
} from "@/lib/pos/pos-web-api-client";

function formatCents(cents: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

export function PosStatisticsScreen() {
  const { restaurantId, ready } = useWorkspaceRestaurantUuid();
  const [orders, setOrders] = useState<PosWebOrderDto[]>([]);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDeferredSkeleton(!ready || loading);

  const load = useCallback(async () => {
    if (!restaurantId) {
      setOrders([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await fetchPosPaidTodayOrders(restaurantId);
      if (!result.ok) {
        toast.error(result.error);
        setOrders([]);
        return;
      }
      setOrders(result.data.orders);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(() => {
    const revenue = orders.reduce((s, o) => s + o.totalCents + o.tipCents, 0);
    const avg =
      orders.length === 0 ? 0 : Math.round(revenue / orders.length);
    return { revenue, avg, count: orders.length };
  }, [orders]);

  if (!ready) {
    return <WorkspaceRestaurantResolvePlaceholder className="py-10" />;
  }
  if (!restaurantId) {
    return <WorkspaceRestaurantMissingMessage className="py-10" />;
  }
  if (showSkeleton) {
    return (
      <div className="grid gap-3 pt-2 sm:grid-cols-3">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pt-2">
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard
          label="Umsatz heute"
          value={formatCents(totals.revenue)}
          hint={`${totals.count} bezahlte Bestellungen`}
          icon={Receipt}
        />
        <KpiCard
          label="Ø Bon"
          value={totals.count === 0 ? "—" : formatCents(totals.avg)}
          hint="heute"
          icon={CreditCard}
        />
        <KpiCard
          label="Bons heute"
          value={String(totals.count)}
          hint="abgeschlossen"
          icon={BarChart3}
        />
      </div>

      <Card className="border-border/50 shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Auswertung</CardTitle>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/50 bg-muted/20 px-4 py-12 text-center">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-muted">
                <BarChart3
                  className="size-6 text-muted-foreground"
                  aria-hidden
                />
              </div>
              <p className="text-sm font-medium">Noch keine POS-Statistiken</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Sobald die Kasse Bestellungen synchronisiert, siehst du hier den
                Tagesumsatz.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border/40 text-sm">
              {orders.slice(0, 20).map((order) => (
                <li
                  key={order.id}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <span className="tabular-nums text-muted-foreground">
                    #{order.orderNumber}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {order.lines.map((l) => l.name).join(", ")}
                  </span>
                  <span className="shrink-0 font-medium tabular-nums">
                    {formatCents(order.totalCents + order.tipCents)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
