"use client";

import { useMemo } from "react";
import { DrawerFilterFooter } from "@/components/ui/drawer-filter-footer";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { drawerScrollAreaClassName } from "@/lib/ui/drawer-form-section";
import { toast } from "sonner";
import { SearchableSelect } from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Drawer,
  DrawerContent,
} from "@/components/ui/drawer";
import {
  DrawerFilterField,
  DrawerFilterHeader,
  DrawerFilterSwitchRow,
  DrawerFilterZone,
  DrawerSortZone,
} from "@/components/ui/drawer-filter-sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { staffDrawerFieldClassName } from "@/components/staff/staff-form-field-styles";
import type { ShiftScheduleSortKey } from "@/lib/types/staff-shift-schedule";
import type { StaffPositionTagDefinition } from "@/lib/types/staff";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import { cn } from "@/lib/utils";

export const SHIFT_PLAN_SORT_LABELS: Record<ShiftScheduleSortKey, string> = {
  name: "Name",
  hours: "Stunden",
};

type ShiftPlanFilterDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  management?: boolean;
  staffFilter: string;
  onStaffFilterChange: (value: string) => void;
  staffOptions: { id: string; label: string }[];
  positionFilter: string;
  onPositionFilterChange: (value: string) => void;
  positionTags: StaffPositionTagDefinition[];
  sortKey: ShiftScheduleSortKey;
  onSortKeyChange: (key: ShiftScheduleSortKey) => void;
  onlyWithShifts: boolean;
  onOnlyWithShiftsChange: (value: boolean) => void;
};

export function countShiftPlanActiveFilters(input: {
  management: boolean;
  staffFilter: string;
  positionFilter: string;
  sortKey: ShiftScheduleSortKey;
  onlyWithShifts: boolean;
}): number {
  let n = 0;
  if (input.management) {
    if (input.staffFilter !== "all") n += 1;
    if (input.positionFilter !== "all") n += 1;
  }
  if (input.sortKey !== "name") n += 1;
  if (input.onlyWithShifts) n += 1;
  return n;
}

export function ShiftPlanFilterDrawer({
  open,
  onOpenChange,
  management = true,
  staffFilter,
  onStaffFilterChange,
  staffOptions,
  positionFilter,
  onPositionFilterChange,
  positionTags,
  sortKey,
  onSortKeyChange,
  onlyWithShifts,
  onOnlyWithShiftsChange,
}: ShiftPlanFilterDrawerProps) {
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

  const resetFilters = () => {
    if (management) {
      onStaffFilterChange("all");
      onPositionFilterChange("all");
    }
    onSortKeyChange("name");
    onOnlyWithShiftsChange(false);
    toast.success("Filter zurückgesetzt");
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom" repositionInputs={false}>
      <DrawerContent className={drawerContentClassName("filter")}>
        <DrawerFilterHeader title="Filter & Sortierung" />

        <div className={drawerScrollAreaClassName(6)}>
          <DrawerFilterZone>
            {management ? (
              <>
                <DrawerFilterField label="Mitarbeiter">
                  <SearchableSelect
                    options={staffFilterOptions}
                    value={staffFilter}
                    onValueChange={onStaffFilterChange}
                    placeholder="Alle Mitarbeiter"
                    searchPlaceholder="Mitarbeiter suchen…"
                    aria-label="Mitarbeiter filtern"
                    className={appSelectTriggerAccentCn(staffDrawerFieldClassName)}
                  />
                </DrawerFilterField>

                <DrawerFilterField label="Bereich">
                  <SearchableSelect
                    options={positionFilterOptions}
                    value={positionFilter}
                    onValueChange={onPositionFilterChange}
                    placeholder="Alle Bereiche"
                    searchPlaceholder="Bereich suchen…"
                    aria-label="Bereich filtern"
                    className={appSelectTriggerAccentCn(staffDrawerFieldClassName)}
                  />
                </DrawerFilterField>
              </>
            ) : null}

            <DrawerFilterSwitchRow>
              <Label htmlFor="shift-plan-only-with-shifts" className="text-sm font-medium">
                Nur mit Schicht
              </Label>
              <Switch
                id="shift-plan-only-with-shifts"
                checked={onlyWithShifts}
                onCheckedChange={onOnlyWithShiftsChange}
              />
            </DrawerFilterSwitchRow>
          </DrawerFilterZone>

          <DrawerSortZone>
            <Select
              value={sortKey}
              onValueChange={(v) => onSortKeyChange(v as ShiftScheduleSortKey)}
            >
              <SelectTrigger
                id="shift-plan-filter-sort"
                className={appSelectTriggerAccentCn(
                  cn(staffDrawerFieldClassName, "h-12 rounded-2xl text-base font-medium"),
                )}
              >
                <SelectValue placeholder="Sortierung wählen">
                  {SHIFT_PLAN_SORT_LABELS[sortKey]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="hours">Stunden</SelectItem>
              </SelectContent>
            </Select>
          </DrawerSortZone>
        </div>
        <DrawerFilterFooter onReset={resetFilters} onDone={() => onOpenChange(false)} />
      </DrawerContent>
    </Drawer>
  );
}
