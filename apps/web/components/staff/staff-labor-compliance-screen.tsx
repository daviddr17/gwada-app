"use client";

import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { AppNavLink } from "@/components/navigation/app-nav-link";
import { StaffWorkHoursSubnav } from "@/components/staff/staff-work-hours-subnav";
import { StaffWorkHoursSkeleton } from "@/components/staff/staff-work-hours-skeleton";
import { LaborComplianceViolationList } from "@/components/staff/labor-compliance-violation-list";
import { StaffWorkHoursLaborFixSection } from "@/components/staff/staff-work-hours-labor-fix-section";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useStaffLaborComplianceData } from "@/lib/hooks/use-staff-labor-compliance-data";
import { useStaffModuleSelection } from "@/lib/contexts/staff-module-selection-context";
import { useRestaurantPermissions } from "@/lib/hooks/use-restaurant-permissions";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { hasModuleUpdate } from "@/lib/permissions/module-crud-permissions";
import { APP_ROUTES } from "@/lib/navigation/app-routes";
import type { LaborComplianceViolation } from "@/lib/staff/labor-law/de-arbzg-rules";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
import { GWADA_STAFF_DATA_REFRESH_EVENT } from "@/lib/staff/staff-live-events";

type SortMode = "date_desc" | "severity" | "staff";

function sortViolations(
  list: LaborComplianceViolation[],
  mode: SortMode,
  staffNameById: ReadonlyMap<string, string>,
): LaborComplianceViolation[] {
  const severityRank = (v: LaborComplianceViolation) =>
    v.severity === "error" ? 0 : 1;
  return [...list].sort((a, b) => {
    if (mode === "severity") {
      const s = severityRank(a) - severityRank(b);
      if (s !== 0) return s;
    }
    if (mode === "staff") {
      const na = staffNameById.get(a.staffId) ?? a.staffId;
      const nb = staffNameById.get(b.staffId) ?? b.staffId;
      const n = na.localeCompare(nb, "de");
      if (n !== 0) return n;
    }
    const d = b.dayYmd.localeCompare(a.dayYmd);
    if (d !== 0) return d;
    return a.title.localeCompare(b.title, "de");
  });
}

export function StaffLaborComplianceScreen() {
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const { has } = useRestaurantPermissions();
  const allowEdit = hasModuleUpdate(has, "staff");
  const { selectedStaffId } = useStaffModuleSelection();

  const [fromYmd, setFromYmd] = useState("");
  const [toYmd, setToYmd] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("date_desc");

  const {
    violations,
    fixableCount,
    loading,
    reload,
    staffNameById,
    lookbackStartYmd,
  } = useStaffLaborComplianceData({
    restaurantId,
    staffId: selectedStaffId,
    enabled: allowEdit && Boolean(restaurantId),
  });

  const showSkeleton = useDeferredSkeleton(loading);

  const filtered = useMemo(() => {
    return violations.filter((v) => {
      if (fromYmd && v.dayYmd < fromYmd) return false;
      if (toYmd && v.dayYmd > toYmd) return false;
      return true;
    });
  }, [violations, fromYmd, toYmd]);

  const sorted = useMemo(
    () => sortViolations(filtered, sortMode, staffNameById),
    [filtered, sortMode, staffNameById],
  );

  const fixable = useMemo(
    () => sorted.filter((v) => v.fixable),
    [sorted],
  );

  const errorCount = useMemo(
    () => sorted.filter((v) => v.severity === "error").length,
    [sorted],
  );

  if (!workspaceReady) return <WorkspaceRestaurantResolvePlaceholder />;
  if (!restaurantId) return <WorkspaceRestaurantMissingMessage />;

  if (!allowEdit) {
    return (
      <>
        <StaffWorkHoursSubnav />
        <p className="text-sm text-muted-foreground">
          Keine Berechtigung für ArbZG-Hinweise und Korrekturen.
        </p>
      </>
    );
  }

  if (showSkeleton) {
    return (
      <>
        <StaffWorkHoursSubnav />
        <StaffWorkHoursSkeleton />
      </>
    );
  }

  return (
    <>
      <StaffWorkHoursSubnav />
      <div className="min-w-0 space-y-5">
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
          <div className="flex items-start gap-2">
            <AlertTriangle
              className="mt-0.5 size-4 shrink-0 text-amber-600"
              aria-hidden
            />
            <div className="min-w-0 space-y-1 break-words">
              <p className="text-sm font-medium">
                Arbeitszeit-Hinweise sortiert prüfen und beheben
              </p>
              <p className="text-xs text-muted-foreground">
                Unverbindliche ArbZG-Prüfung ({lookbackStartYmd} – heute).
                Keine Rechtsberatung — Tarifverträge können abweichen. Im{" "}
                <AppNavLink
                  href={APP_ROUTES.mitarbeiter.hours}
                  className="font-medium text-accent underline-offset-4 hover:underline"
                >
                  Kalender
                </AppNavLink>{" "}
                siehst du Hinweise pro Tag im Kontext der Einträge.
              </p>
            </div>
          </div>
        </div>

        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-border/50 bg-card px-3 py-2.5">
            <p className="text-xs text-muted-foreground">Hinweise</p>
            <p className="text-lg font-semibold tabular-nums">{sorted.length}</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card px-3 py-2.5">
            <p className="text-xs text-muted-foreground">Kritisch</p>
            <p className="text-lg font-semibold tabular-nums text-destructive">
              {errorCount}
            </p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card px-3 py-2.5">
            <p className="text-xs text-muted-foreground">Behebbar (Pausen)</p>
            <p className="text-lg font-semibold tabular-nums text-accent">
              {fixableCount}
            </p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card px-3 py-2.5">
            <p className="text-xs text-muted-foreground">Im Filter</p>
            <p className="text-lg font-semibold tabular-nums">{filtered.length}</p>
          </div>
        </div>

        {fixable.length > 0 ? (
          <StaffWorkHoursLaborFixSection
            violations={fixable}
            restaurantId={restaurantId}
            onFixed={() => {
              void reload();
              window.dispatchEvent(new Event(GWADA_STAFF_DATA_REFRESH_EVENT));
            }}
          />
        ) : null}

        <div className="grid min-w-0 gap-3 sm:grid-cols-3">
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="labor-fix-from">Von</Label>
            <Input
              id="labor-fix-from"
              type="date"
              value={fromYmd}
              onChange={(e) => setFromYmd(e.target.value)}
              className="h-10 w-full min-w-0 rounded-xl"
            />
          </div>
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="labor-fix-to">Bis</Label>
            <Input
              id="labor-fix-to"
              type="date"
              value={toYmd}
              onChange={(e) => setToYmd(e.target.value)}
              className="h-10 w-full min-w-0 rounded-xl"
            />
          </div>
          <div className="min-w-0 space-y-1.5">
            <Label>Sortierung</Label>
            <Select
              value={sortMode}
              onValueChange={(v) => {
                if (v === "date_desc" || v === "severity" || v === "staff") {
                  setSortMode(v);
                }
              }}
            >
              <SelectTrigger
                className={appSelectTriggerAccentCn("h-10 w-full rounded-xl")}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date_desc">Datum (neueste zuerst)</SelectItem>
                <SelectItem value="severity">Schwere (kritisch zuerst)</SelectItem>
                <SelectItem value="staff">Mitarbeiter (A–Z)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="min-w-0 space-y-2">
          <p className="text-sm font-medium">
            Alle Hinweise ({sorted.length})
          </p>
          <LaborComplianceViolationList violations={sorted} staffLabelById={staffNameById} />
        </div>
      </div>
    </>
  );
}
