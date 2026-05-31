"use client";

import { Users } from "lucide-react";
import {
  DashboardStatBlock,
  DashboardWidgetStatsGrid,
} from "@/components/dashboard/dashboard-stat-block";
import { DashboardWidgetShell } from "@/components/dashboard/dashboard-widget-shell";
import { useDashboardContactsStats } from "@/lib/hooks/use-dashboard-contacts-stats";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";

export function DashboardContactsTile() {
  const { summary, loading, error, ready } = useDashboardContactsStats();
  const showSkeleton = useDeferredSkeleton(!ready || loading);

  return (
    <DashboardWidgetShell
      title="Kontakte"
      description="Stammkunden und Gäste mit Reservierungsbezug."
      icon={<Users className="size-5 shrink-0 text-muted-foreground" aria-hidden />}
      href="/kontakte/uebersicht"
      linkLabel="Zu Kontakte"
      ready={ready}
      loading={showSkeleton}
      error={error}
    >
      <DashboardWidgetStatsGrid>
        <DashboardStatBlock
          label="Kontakte gesamt"
          primary={String(summary?.total ?? 0)}
          secondary="Im Adressbuch des Restaurants"
        />
        <DashboardStatBlock
          label="Mit Reservierung"
          primary={String(summary?.withReservation ?? 0)}
          secondary="Mindestens eine verknüpfte Reservierung"
        />
        <DashboardStatBlock
          label="Firmenkontakte"
          primary={String(summary?.withCompany ?? 0)}
          secondary="Einträge mit Unternehmensname"
        />
      </DashboardWidgetStatsGrid>
    </DashboardWidgetShell>
  );
}
