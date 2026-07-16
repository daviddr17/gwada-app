"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  BarChart3,
  MonitorSmartphone,
  Receipt,
  ShoppingBag,
} from "lucide-react";
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
import { APP_ROUTES } from "@/lib/navigation/app-routes";
import {
  fetchPosActiveOrders,
  fetchPosPaidTodayOrders,
  fetchPosRegisterStatus,
} from "@/lib/pos/pos-web-api-client";

const HUB_LINKS = [
  {
    href: APP_ROUTES.pos.orders,
    label: "Bestellungen",
    description: "Offene und abgeschlossene Bestellungen aus Kasse und Online.",
    icon: ShoppingBag,
  },
  {
    href: APP_ROUTES.pos.statistics,
    label: "Statistiken",
    description: "Umsatz, Zahlungsmittel und Tagesabschlüsse.",
    icon: BarChart3,
  },
  {
    href: APP_ROUTES.pos.settings,
    label: "Einstellungen",
    description: "TSE, Fiskalisierung und Kassen-Konfiguration.",
    icon: Receipt,
  },
] as const;

function formatCents(cents: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

export function PosOverviewScreen() {
  const { restaurantId, ready } = useWorkspaceRestaurantUuid();
  const [loading, setLoading] = useState(true);
  const [activeCount, setActiveCount] = useState<number | null>(null);
  const [paidTodayCents, setPaidTodayCents] = useState<number | null>(null);
  const [registerOpen, setRegisterOpen] = useState<boolean | null>(null);
  const showSkeleton = useDeferredSkeleton(!ready || loading);

  const load = useCallback(async () => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [active, paid, register] = await Promise.all([
        fetchPosActiveOrders(restaurantId),
        fetchPosPaidTodayOrders(restaurantId),
        fetchPosRegisterStatus(restaurantId),
      ]);
      if (active.ok) setActiveCount(active.data.orders.length);
      else {
        toast.error(active.error);
        setActiveCount(null);
      }
      if (paid.ok) {
        setPaidTodayCents(
          paid.data.orders.reduce((sum, o) => sum + o.totalCents + o.tipCents, 0),
        );
      } else {
        setPaidTodayCents(null);
      }
      if (register.ok) setRegisterOpen(register.data.isOpen);
      else setRegisterOpen(null);
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
          value={paidTodayCents == null ? "—" : formatCents(paidTodayCents)}
          hint="Bezahlte Bestellungen"
          icon={Receipt}
        />
        <KpiCard
          label="Offene Bestellungen"
          value={activeCount == null ? "—" : String(activeCount)}
          hint="Noch nicht abgeschlossen"
          icon={ShoppingBag}
        />
        <KpiCard
          label="Kasse"
          value={
            registerOpen == null ? "—" : registerOpen ? "Geöffnet" : "Geschlossen"
          }
          hint="Register-Status"
          icon={MonitorSmartphone}
        />
      </div>

      <Card className="border-border/50 shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">POS-Hub</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Hier laufen Bestellungen, Auswertungen und Fiskal-Einstellungen
            zusammen. Die Bedienung an Tisch und Theke bleibt in der nativen
            POS-App (iPad als Hub, iPhone als Handgerät — lokal auch ohne
            Internet).
          </p>
          <ul className="space-y-2">
            {HUB_LINKS.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="flex gap-3 rounded-xl border border-border/50 bg-muted/20 px-3 py-3 transition-colors hover:bg-muted/40"
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                      <Icon className="size-4" aria-hidden />
                    </div>
                    <span className="min-w-0">
                      <span className="block font-medium text-foreground">
                        {item.label}
                      </span>
                      <span className="mt-0.5 block text-xs leading-relaxed">
                        {item.description}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
