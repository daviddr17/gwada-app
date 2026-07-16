"use client";

import Link from "next/link";
import {
  BarChart3,
  MonitorSmartphone,
  Receipt,
  ShoppingBag,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { APP_ROUTES } from "@/lib/navigation/app-routes";

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

export function PosOverviewScreen() {
  const { restaurantId, ready } = useWorkspaceRestaurantUuid();

  if (!ready) {
    return <WorkspaceRestaurantResolvePlaceholder className="py-10" />;
  }
  if (!restaurantId) {
    return <WorkspaceRestaurantMissingMessage className="py-10" />;
  }

  return (
    <div className="space-y-6 pt-2">
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard
          label="Umsatz heute"
          value="—"
          hint="Live-Daten folgen"
          icon={Receipt}
        />
        <KpiCard
          label="Bestellungen heute"
          value="—"
          hint="Live-Daten folgen"
          icon={ShoppingBag}
        />
        <KpiCard
          label="Offene Tische"
          value="—"
          hint="Live-Daten folgen"
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
            POS-App (iPad als Hub, iPhone als Handgerät).
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
