"use client";

import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Filter,
  Settings2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  countShiftPlanActiveFilters,
  ShiftPlanFilterDrawer,
} from "@/components/staff/shift-plan/shift-plan-filter-drawer";
import { cn } from "@/lib/utils";
import {
  type ShiftScheduleSortKey,
  type ShiftScheduleViewMode,
} from "@/lib/types/staff-shift-schedule";
import { formatViewTitleDe, SHIFT_SCHEDULE_VIEW_LABELS } from "@/lib/staff/shift-schedule-range";
import type { StaffPositionTagDefinition } from "@/lib/types/staff";

type ShiftPlanToolbarProps = {
  view: ShiftScheduleViewMode;
  onViewChange: (view: ShiftScheduleViewMode) => void;
  anchor: Date;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  positionFilter: string;
  onPositionFilterChange: (value: string) => void;
  positionTags: StaffPositionTagDefinition[];
  staffFilter: string;
  onStaffFilterChange: (value: string) => void;
  staffOptions: { id: string; label: string }[];
  sortKey: ShiftScheduleSortKey;
  onSortKeyChange: (key: ShiftScheduleSortKey) => void;
  onCopy: () => void;
  onExport: () => void;
  onSettings: () => void;
  management?: boolean;
};

export function ShiftPlanToolbar({
  view,
  onViewChange,
  anchor,
  onPrev,
  onNext,
  onToday,
  positionFilter,
  onPositionFilterChange,
  positionTags,
  staffFilter,
  onStaffFilterChange,
  staffOptions,
  sortKey,
  onSortKeyChange,
  onCopy,
  onExport,
  onSettings,
  management = true,
}: ShiftPlanToolbarProps) {
  const [filterOpen, setFilterOpen] = useState(false);

  const filterActiveCount = useMemo(
    () =>
      countShiftPlanActiveFilters({
        management,
        staffFilter,
        positionFilter,
        sortKey,
      }),
    [management, positionFilter, sortKey, staffFilter],
  );

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-border/50 bg-muted/10 p-0.5">
          {(["day", "week", "month"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                view === mode
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => onViewChange(mode)}
            >
              {SHIFT_SCHEDULE_VIEW_LABELS[mode]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <Button type="button" variant="outline" size="icon-sm" onClick={onPrev}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-w-[10rem] px-3 text-sm font-medium"
            onClick={onToday}
          >
            {formatViewTitleDe(anchor, view)}
          </Button>
          <Button type="button" variant="outline" size="icon-sm" onClick={onNext}>
            <ChevronRight className="size-4" />
          </Button>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="relative shrink-0">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              className="rounded-full border-border/60"
              aria-label="Filter und Sortierung"
              onClick={() => setFilterOpen(true)}
            >
              <Filter className="size-4" />
            </Button>
            {filterActiveCount > 0 ? (
              <Badge
                variant="secondary"
                className="pointer-events-none absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-medium tabular-nums"
              >
                {filterActiveCount}
              </Badge>
            ) : null}
          </div>
          {management ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label="Schichten kopieren"
                onClick={onCopy}
              >
                <Copy className="size-4" />
              </Button>
              <Button type="button" variant="outline" size="icon-sm" onClick={onSettings}>
                <Settings2 className="size-4" />
              </Button>
            </>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Schichtplan exportieren"
            onClick={onExport}
          >
            <Download className="size-4" />
          </Button>
        </div>
      </div>

      <ShiftPlanFilterDrawer
        open={filterOpen}
        onOpenChange={setFilterOpen}
        management={management}
        staffFilter={staffFilter}
        onStaffFilterChange={onStaffFilterChange}
        staffOptions={staffOptions}
        positionFilter={positionFilter}
        onPositionFilterChange={onPositionFilterChange}
        positionTags={positionTags}
        sortKey={sortKey}
        onSortKeyChange={onSortKeyChange}
      />
    </>
  );
}
