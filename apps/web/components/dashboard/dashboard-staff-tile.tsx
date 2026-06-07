"use client";

import { useMemo, useState } from "react";
import { UserCheck } from "lucide-react";
import {
  DashboardCompactInlineMetrics,
  DashboardCompactMetricPill,
} from "@/components/dashboard/dashboard-compact-list";
import { DashboardWidgetShell } from "@/components/dashboard/dashboard-widget-shell";
import {
  StaffOverviewLivePresenceSheet,
  type StaffLivePresenceSheetMode,
} from "@/components/staff/staff-overview-live-presence-sheet";
import { useDashboardStaffStats } from "@/lib/hooks/use-dashboard-staff-stats";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { formatHoursDe } from "@/lib/staff/staff-work-hours-summary";

export function DashboardStaffTile() {
  const { summary, staff, presence, loading, error, ready } =
    useDashboardStaffStats();
  const showSkeleton = useDeferredSkeleton(!ready || (loading && !summary));
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
      <DashboardCompactInlineMetrics>
        <DashboardCompactMetricPill
          label="Aktiv"
          value={String(active)}
          highlight={active > 0}
          stripeVariant="active"
          onClick={() => setPresenceSheetMode("working")}
        />
        <DashboardCompactMetricPill
          label="In Pause"
          value={String(onBreak)}
          highlight={onBreak > 0}
          stripeVariant="break"
          onClick={() => setPresenceSheetMode("on_break")}
        />
        <DashboardCompactMetricPill
          label="Heute"
          value={todayHours > 0 ? formatHoursDe(todayHours) : "0 h"}
          href="/mitarbeiter/arbeitszeiten"
        />
        {summary && summary.totalStaff > 0 ? (
          <DashboardCompactMetricPill
            label="Team"
            value={String(summary.totalStaff)}
            href="/mitarbeiter/uebersicht"
          />
        ) : null}
      </DashboardCompactInlineMetrics>

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
