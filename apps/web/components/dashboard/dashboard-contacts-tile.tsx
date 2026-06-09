"use client";

import { Users } from "lucide-react";
import {
  DashboardCompactInlineMetrics,
  DashboardCompactMetricPill,
} from "@/components/dashboard/dashboard-compact-list";
import { DashboardWidgetShell } from "@/components/dashboard/dashboard-widget-shell";
import { useDashboardContactsStats } from "@/lib/hooks/use-dashboard-contacts-stats";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";

export function DashboardContactsTile() {
  const { summary, loading, error, ready } = useDashboardContactsStats();
  const showSkeleton = useDeferredSkeleton(!ready || (loading && !summary));

  return (
    <DashboardWidgetShell
      title="Kontakte"
      icon={<Users className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
      href="/dashboard/kontakte/uebersicht"
      linkLabel="Zu Kontakte"
      ready={ready}
      loading={showSkeleton}
      error={error}
    >
      <DashboardCompactInlineMetrics>
        <DashboardCompactMetricPill
          label="Gesamt"
          value={String(summary?.total ?? 0)}
        />
        <DashboardCompactMetricPill
          label="Mit Reservierung"
          value={String(summary?.withReservation ?? 0)}
        />
        <DashboardCompactMetricPill
          label="Firmenkontakte"
          value={String(summary?.withCompany ?? 0)}
        />
      </DashboardCompactInlineMetrics>
    </DashboardWidgetShell>
  );
}
