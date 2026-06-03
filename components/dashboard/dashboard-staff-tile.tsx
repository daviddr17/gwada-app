"use client";

import { useMemo, useState } from "react";
import { Coffee, UserCheck, Users } from "lucide-react";
import {
  DashboardStatBlock,
  DashboardWidgetStatsGrid,
} from "@/components/dashboard/dashboard-stat-block";
import { DashboardWidgetShell } from "@/components/dashboard/dashboard-widget-shell";
import {
  StaffOverviewLivePresenceSheet,
  type StaffLivePresenceSheetMode,
} from "@/components/staff/staff-overview-live-presence-sheet";
import { useDashboardStaffStats } from "@/lib/hooks/use-dashboard-staff-stats";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { formatHoursDe } from "@/lib/staff/staff-work-hours-summary";
import { formatDashboardStaffTodayWorkLabel } from "@/lib/staff/compute-dashboard-staff-summary";

export function DashboardStaffTile() {
  const { summary, staff, presence, loading, error, ready } =
    useDashboardStaffStats();
  const showSkeleton = useDeferredSkeleton(!ready || loading);
  const [presenceSheetMode, setPresenceSheetMode] =
    useState<StaffLivePresenceSheetMode | null>(null);
  const active = summary?.activeStaff ?? 0;
  const onBreak = summary?.onBreakStaff ?? 0;
  const todayHours = summary?.todayWorkHours ?? 0;

  const staffById = useMemo(
    () => new Map(staff.map((row) => [row.id, row] as const)),
    [staff],
  );

  return (
    <DashboardWidgetShell
      title="Mitarbeiter"
      icon={
        <UserCheck
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
      }
      href="/mitarbeiter/uebersicht"
      linkLabel="Zur Übersicht"
      ready={ready}
      loading={showSkeleton}
      error={error}
    >
      <DashboardWidgetStatsGrid columns={2}>
        <DashboardStatBlock
          size="compact"
          label="Aktiv"
          primary={String(active)}
          secondary="Gerade in Schicht (Display)"
          highlight={active > 0}
          onClick={() => setPresenceSheetMode("working")}
        />
        <DashboardStatBlock
          size="compact"
          label="In Pause"
          primary={String(onBreak)}
          secondary={
            onBreak > 0 ? (
              <>
                <Coffee
                  className="mr-1 inline size-3.5 align-[-0.15em] text-muted-foreground"
                  aria-hidden
                />
                Pause am Display
              </>
            ) : (
              "Keine aktive Pause"
            )
          }
          highlight={onBreak > 0}
          onClick={() => setPresenceSheetMode("on_break")}
        />
        <DashboardStatBlock
          size="compact"
          label="Arbeitszeit heute"
          primary={todayHours > 0 ? formatHoursDe(todayHours) : "0 h"}
          secondary={formatDashboardStaffTodayWorkLabel(todayHours)}
          href="/mitarbeiter/arbeitszeiten"
        />
      </DashboardWidgetStatsGrid>
      {summary && summary.totalStaff > 0 ? (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Users className="size-3.5 shrink-0" aria-hidden />
          {summary.totalStaff}{" "}
          {summary.totalStaff === 1 ? "aktiver Mitarbeiter" : "aktive Mitarbeiter"}{" "}
          im Team
        </p>
      ) : null}

      {presenceSheetMode ? (
        <StaffOverviewLivePresenceSheet
          open={presenceSheetMode !== null}
          onOpenChange={(open) => {
            if (!open) setPresenceSheetMode(null);
          }}
          mode={presenceSheetMode}
          presence={presence}
          staffById={staffById}
        />
      ) : null}
    </DashboardWidgetShell>
  );
}
