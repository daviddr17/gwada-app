"use client";

import { useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Plus,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
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
  search: string;
  onSearchChange: (value: string) => void;
  positionFilter: string;
  onPositionFilterChange: (value: string) => void;
  positionTags: StaffPositionTagDefinition[];
  staffFilter: string;
  onStaffFilterChange: (value: string) => void;
  staffOptions: { id: string; label: string }[];
  sortKey: ShiftScheduleSortKey;
  onSortKeyChange: (key: ShiftScheduleSortKey) => void;
  onAdd: () => void;
  onCopy: () => void;
  onExport: () => void;
  onSettings: () => void;
  management?: boolean;
};

const SORT_LABELS: Record<ShiftScheduleSortKey, string> = {
  name: "Name",
  hours: "Stunden",
};

export function ShiftPlanToolbar({
  view,
  onViewChange,
  anchor,
  onPrev,
  onNext,
  onToday,
  search,
  onSearchChange,
  positionFilter,
  onPositionFilterChange,
  positionTags,
  staffFilter,
  onStaffFilterChange,
  staffOptions,
  sortKey,
  onSortKeyChange,
  onAdd,
  onCopy,
  onExport,
  onSettings,
  management = true,
}: ShiftPlanToolbarProps) {
  const staffFilterOptions = useMemo(
    () => [
      { value: "all", label: "Alle Mitarbeiter" },
      ...staffOptions.map((s) => ({ value: s.id, label: s.label })),
    ],
    [staffOptions],
  );

  const positionFilterOptions = useMemo(
    () => [
      { value: "all", label: "Alle Bereiche" },
      ...positionTags.map((t) => ({
        value: t.id,
        label: t.name,
        leadingColor: t.backgroundColor,
      })),
    ],
    [positionTags],
  );

  return (
    <div className="space-y-3">
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
          {management ? (
            <>
              <Button type="button" variant="outline" size="sm" onClick={onCopy}>
                <Copy className="size-4" />
                Kopieren
              </Button>
              <Button type="button" variant="outline" size="icon-sm" onClick={onSettings}>
                <Settings2 className="size-4" />
              </Button>
              <Button type="button" size="lg" className="gap-2" onClick={onAdd}>
                <Plus className="size-4" />
                Schicht
              </Button>
            </>
          ) : null}
          <Button type="button" variant="outline" size="sm" onClick={onExport}>
            <Download className="size-4" />
            Export
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {!management ? null : (
          <>
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Mitarbeiter suchen …"
              className="h-9 w-full max-w-xs"
            />
            <SearchableSelect
              options={staffFilterOptions}
              value={staffFilter}
              onValueChange={onStaffFilterChange}
              placeholder="Alle Mitarbeiter"
              searchPlaceholder="Mitarbeiter suchen…"
              aria-label="Mitarbeiter filtern"
              className={appSelectTriggerAccentCn("h-9 w-[11rem] min-w-[11rem]")}
            />
            <SearchableSelect
              options={positionFilterOptions}
              value={positionFilter}
              onValueChange={onPositionFilterChange}
              placeholder="Alle Bereiche"
              searchPlaceholder="Bereich suchen…"
              aria-label="Bereich filtern"
              className={appSelectTriggerAccentCn("h-9 w-[10rem] min-w-[10rem]")}
            />
          </>
        )}
        <div className="inline-flex items-center gap-1.5 rounded-lg border border-border/50 bg-muted/10 px-2 py-0.5">
          <span className="text-xs text-muted-foreground">Sortierung</span>
          <Select
            value={sortKey}
            onValueChange={(v) => onSortKeyChange(v as ShiftScheduleSortKey)}
          >
            <SelectTrigger
              className={appSelectTriggerAccentCn(
                "h-8 w-[6.5rem] min-w-[6.5rem] border-0 bg-transparent px-1 shadow-none",
              )}
            >
              <SelectValue placeholder="Sortierung">
                {SORT_LABELS[sortKey]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="hours">Stunden</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
