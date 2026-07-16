"use client";

import { useCallback, useEffect, useState } from "react";
import { ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import {
  fetchPosActiveOrders,
  type PosWebOrderDto,
} from "@/lib/pos/pos-web-api-client";
import { Skeleton } from "@/components/ui/skeleton";
import { moduleDataTableHeadRowClassName } from "@/lib/ui/module-data-table";
import { ModuleDataTableFrame } from "@/lib/ui/module-paginated-data-table";

function formatCents(cents: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

function PosOrdersSkeleton() {
  return (
    <div className="space-y-3 pt-2">
      <Skeleton className="h-10 w-full rounded-xl" />
      <Skeleton className="h-48 w-full rounded-xl" />
    </div>
  );
}

export function PosOrdersScreen() {
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
      const result = await fetchPosActiveOrders(restaurantId);
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

  if (!ready) {
    return <WorkspaceRestaurantResolvePlaceholder className="py-10" />;
  }
  if (!restaurantId) {
    return <WorkspaceRestaurantMissingMessage className="py-10" />;
  }
  if (showSkeleton) {
    return <PosOrdersSkeleton />;
  }

  if (orders.length === 0) {
    return (
      <div className="space-y-4 pt-2">
        <Card className="border-border/50 shadow-card">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/50 bg-muted/20 px-4 py-12 text-center">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-muted">
                <ShoppingBag
                  className="size-6 text-muted-foreground"
                  aria-hidden
                />
              </div>
              <p className="text-sm font-medium">Keine offenen Bestellungen</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Bestellungen aus der Kasse erscheinen hier, sobald sie an die
                Cloud synchronisiert sind.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-2">
      <ModuleDataTableFrame>
        <table className="w-full text-sm">
          <thead>
            <tr className={moduleDataTableHeadRowClassName}>
              <th className="px-3 py-2 text-left font-medium">Nr.</th>
              <th className="px-3 py-2 text-left font-medium">Status</th>
              <th className="px-3 py-2 text-left font-medium">Positionen</th>
              <th className="px-3 py-2 text-right font-medium">Summe</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="border-t border-border/40">
                <td className="px-3 py-2.5 tabular-nums">#{order.orderNumber}</td>
                <td className="px-3 py-2.5 capitalize">{order.status}</td>
                <td className="px-3 py-2.5 text-muted-foreground">
                  {order.lines.map((l) => `${l.quantity}× ${l.name}`).join(", ")}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums font-medium">
                  {formatCents(order.totalCents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ModuleDataTableFrame>
    </div>
  );
}
