"use client";

import { CalendarDays, ClipboardList, Users } from "lucide-react";
import {
  DashboardStatBlock,
  DashboardWidgetStatsGrid,
} from "@/components/dashboard/dashboard-stat-block";
import { DashboardWidgetShell } from "@/components/dashboard/dashboard-widget-shell";
import { useDashboardReservationStats } from "@/lib/hooks/use-dashboard-reservation-stats";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { reservationsUnconfirmedOverviewHref } from "@/lib/reservations/unconfirmed-reservations";

export function DashboardReservationsTile() {
  const { summary, loading, error, ready } = useDashboardReservationStats();
  const showSkeleton = useDeferredSkeleton(!ready || loading);
  const unconfirmed = summary?.unconfirmedCount ?? 0;

  return (
    <DashboardWidgetShell
      title="Reservierungen"
      description="Unbestätigte Anfragen, heute und aktuelle Kalenderwoche (Mo–So)."
      icon={
        <CalendarDays
          className="size-5 shrink-0 text-muted-foreground"
          aria-hidden
        />
      }
      href="/reservierungen/uebersicht"
      linkLabel="Zur Übersicht"
      ready={ready}
      loading={showSkeleton}
      error={error}
    >
      <DashboardWidgetStatsGrid>
        <DashboardStatBlock
          label="Unbestätigt"
          primary={String(unconfirmed)}
          secondary={
            unconfirmed === 1
              ? "Tippen für alle offenen · Änderung prüfen"
              : "Tippen für alle offenen · Änderungen prüfen"
          }
          highlight={unconfirmed > 0}
          href={reservationsUnconfirmedOverviewHref()}
        />
        <DashboardStatBlock
          label="Heute"
          primary={String(summary?.todayReservations ?? 0)}
          secondary={
            <>
              <Users
                className="mr-1 inline size-3.5 align-[-0.15em] text-muted-foreground"
                aria-hidden
              />
              {summary?.todayGuests ?? 0}{" "}
              {(summary?.todayGuests ?? 0) === 1 ? "Person" : "Personen"}
            </>
          }
        />
        <DashboardStatBlock
          label="Diese Woche"
          primary={String(summary?.weekReservations ?? 0)}
          secondary={
            <>
              <ClipboardList
                className="mr-1 inline size-3.5 align-[-0.15em] text-muted-foreground"
                aria-hidden
              />
              {summary?.weekGuests ?? 0}{" "}
              {(summary?.weekGuests ?? 0) === 1 ? "Person" : "Personen"}
            </>
          }
        />
      </DashboardWidgetStatsGrid>
    </DashboardWidgetShell>
  );
}
