"use client";

import { useMemo } from "react";
import { DrawerFilterFooter } from "@/components/ui/drawer-filter-footer";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { drawerScrollAreaClassName, drawerFormHeaderClassName } from "@/lib/ui/drawer-form-section";
import { toast } from "sonner";
import { SearchableSelect } from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { DrawerFormSection } from "@/components/ui/drawer-form-section";
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
        <DrawerHeader className={drawerFormHeaderClassName(6)}>
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            Filter & Sortierung
          </DrawerTitle>
          <DrawerDescription className="text-base">
            {management
              ? "Mitarbeiter eingrenzen und die Anzeige im Schichtplan sortieren."
              : "Sortierung der Mitarbeiterzeilen im Schichtplan."}
          </DrawerDescription>
        </DrawerHeader>

        <div className={drawerScrollAreaClassName(6)}>
          {management ? (
            <>
              <DrawerFormSection title="Mitarbeiter">
                <SearchableSelect
                  options={staffFilterOptions}
                  value={staffFilter}
                  onValueChange={onStaffFilterChange}
                  placeholder="Alle Mitarbeiter"
                  searchPlaceholder="Mitarbeiter suchen…"
                  aria-label="Mitarbeiter filtern"
                  className={appSelectTriggerAccentCn(staffDrawerFieldClassName)}
                />
              </DrawerFormSection>

              <DrawerFormSection title="Bereich">
                <SearchableSelect
                  options={positionFilterOptions}
                  value={positionFilter}
                  onValueChange={onPositionFilterChange}
                  placeholder="Alle Bereiche"
                  searchPlaceholder="Bereich suchen…"
                  aria-label="Bereich filtern"
                  className={appSelectTriggerAccentCn(staffDrawerFieldClassName)}
                />
              </DrawerFormSection>
            </>
          ) : null}

          <DrawerFormSection title="Anzeige">
            <div className="flex items-center justify-between gap-4 rounded-xl border border-border/50 bg-muted/10 px-4 py-3">
              <div className="min-w-0 space-y-0.5">
                <Label htmlFor="shift-plan-only-with-shifts" className="text-sm font-medium">
                  Nur mit Schicht
                </Label>
                <p className="text-xs text-muted-foreground">
                  Zeigt nur Mitarbeiter mit geplanter Schicht im aktuellen
                  Zeitraum.
                </p>
              </div>
              <Switch
                id="shift-plan-only-with-shifts"
                checked={onlyWithShifts}
                onCheckedChange={onOnlyWithShiftsChange}
              />
            </div>
          </DrawerFormSection>

          <DrawerFormSection title="Sortierung">
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
            <p className="text-xs text-muted-foreground">
              {sortKey === "hours"
                ? "Mitarbeiter mit den meisten geplanten Stunden oben."
                : "Alphabetisch nach Anzeigenamen."}
            </p>
          </DrawerFormSection>
        </div>
        <DrawerFilterFooter onReset={resetFilters} onDone={() => onOpenChange(false)} />
      </DrawerContent>
    </Drawer>
  );
}
