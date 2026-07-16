"use client";

import { BarChart3, CreditCard, Receipt } from "lucide-react";
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

export function PosStatisticsScreen() {
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
          label="Umsatz (Zeitraum)"
          value="—"
          hint="folgt"
          icon={Receipt}
        />
        <KpiCard
          label="Ø Bon"
          value="—"
          hint="folgt"
          icon={CreditCard}
        />
        <KpiCard
          label="Abschlüsse"
          value="—"
          hint="folgt"
          icon={BarChart3}
        />
      </div>

      <Card className="border-border/50 shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Auswertung</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/50 bg-muted/20 px-4 py-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-muted">
              <BarChart3
                className="size-6 text-muted-foreground"
                aria-hidden
              />
            </div>
            <p className="text-sm font-medium">Noch keine POS-Statistiken</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Sobald die Kasse Bestellungen und Abschlüsse liefert, siehst du
              hier Umsatz, Zahlungsmittel und Trends.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
