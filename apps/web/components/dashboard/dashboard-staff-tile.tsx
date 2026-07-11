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
import { StaffOverviewCompletedShiftsSheet } from "@/components/staff/staff-overview-completed-shifts-sheet";
import { StaffLivePresenceNameChips } from "@/components/staff/staff-live-presence-name-chips";
import { useDashboardStaffStats } from "@/lib/hooks/use-dashboard-staff-stats";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useRestaurantIanaTimezone } from "@/lib/hooks/use-restaurant-iana-timezone";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { restaurantTodayYmd } from "@/lib/restaurant/restaurant-timezone";
import { formatHoursDe } from "@/lib/staff/staff-work-hours-summary";

export function DashboardStaffTile() {
  const { restaurantId } = useWorkspaceRestaurantUuid();
  const restaurantTimeZone = useRestaurantIanaTimezone(restaurantId);
  const { summary, staff, presence, completedShifts, loading, error, ready } =
    useDashboardStaffStats();
  const showSkeleton = useDeferredSkeleton(!ready || (loading && !summary));
  const [presenceSheetMode, setPresenceSheetMode] =
    useState<StaffLivePresenceSheetMode | null>(null);
  const [completedSheetOpen, setCompletedSheetOpen] = useState(false);
  const active = summary?.activeStaff ?? 0;
  const onBreak = summary?.onBreakStaff ?? 0;
  const completed = summary?.completedShiftsToday ?? 0;
  const todayHours = summary?.todayWorkHours ?? 0;

  const staffById = useMemo(
    () => new Map(staff.map((row) => [row.id, row] as const)),
    [staff],
  );

  const hasLiveChips = active > 0 || onBreak > 0;

  return (
    <DashboardWidgetShell
      title="Mitarbeiter"
      icon={
        <UserCheck
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
      }
      href="/dashboard/mitarbeiter/uebersicht"
      linkLabel="Zur Übersicht"
      ready={ready}
      loading={showSkeleton}
      error={error}
    >
      <div className="space-y-2">
        <DashboardCompactInlineMetrics>
          <DashboardCompactMetricPill
            label="Live aktiv"
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
            label="Abgeschlossen"
            value={String(completed)}
            highlight={completed > 0}
            onClick={() => setCompletedSheetOpen(true)}
          />
          <DashboardCompactMetricPill
            label="Heute"
            value={todayHours > 0 ? formatHoursDe(todayHours) : "0 h"}
            href="/dashboard/mitarbeiter/arbeitszeiten"
          />
          {summary && summary.totalStaff > 0 ? (
            <DashboardCompactMetricPill
              label="Team"
              value={String(summary.totalStaff)}
              href="/dashboard/mitarbeiter/uebersicht"
            />
          ) : null}
        </DashboardCompactInlineMetrics>

        {hasLiveChips ? (
          <div className="space-y-1.5">
            {active > 0 ? (
              <StaffLivePresenceNameChips
                presence={presence}
                staffById={staffById}
                mode="working"
              />
            ) : null}
            {onBreak > 0 ? (
              <StaffLivePresenceNameChips
                presence={presence}
                staffById={staffById}
                mode="on_break"
              />
            ) : null}
          </div>
        ) : null}
      </div>

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

      {completedSheetOpen ? (
        <StaffOverviewCompletedShiftsSheet
          open={completedSheetOpen}
          onOpenChange={setCompletedSheetOpen}
          dayYmd={restaurantTodayYmd(restaurantTimeZone)}
          shifts={completedShifts}
          staffById={staffById}
        />
      ) : null}
    </DashboardWidgetShell>
  );
}
