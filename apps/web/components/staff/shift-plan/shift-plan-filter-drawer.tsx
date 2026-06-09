"use client";

import { useMemo } from "react";
import { toast } from "sonner";
import { SearchableSelect } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
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
};

export function countShiftPlanActiveFilters(input: {
  management: boolean;
  staffFilter: string;
  positionFilter: string;
  sortKey: ShiftScheduleSortKey;
}): number {
  let n = 0;
  if (input.management) {
    if (input.staffFilter !== "all") n += 1;
    if (input.positionFilter !== "all") n += 1;
  }
  if (input.sortKey !== "name") n += 1;
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
    toast.success("Filter zurückgesetzt");
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom" repositionInputs={false}>
      <DrawerContent className="mx-auto flex max-h-[min(92dvh,560px)] max-w-lg flex-col overflow-hidden rounded-t-[1.75rem] border-0 bg-card shadow-elevated">
        <DrawerHeader className="shrink-0 px-6 pt-2 pb-2 text-left">
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            Filter & Sortierung
          </DrawerTitle>
          <DrawerDescription className="text-base">
            {management
              ? "Mitarbeiter eingrenzen und die Anzeige im Schichtplan sortieren."
              : "Sortierung der Mitarbeiterzeilen im Schichtplan."}
          </DrawerDescription>
        </DrawerHeader>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overflow-x-hidden overscroll-contain px-6 pb-2">
          {management ? (
            <>
              <div className="space-y-3">
                <Label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Mitarbeiter
                </Label>
                <SearchableSelect
                  options={staffFilterOptions}
                  value={staffFilter}
                  onValueChange={onStaffFilterChange}
                  placeholder="Alle Mitarbeiter"
                  searchPlaceholder="Mitarbeiter suchen…"
                  aria-label="Mitarbeiter filtern"
                  className={appSelectTriggerAccentCn(staffDrawerFieldClassName)}
                />
              </div>

              <div className="space-y-3">
                <Label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Bereich
                </Label>
                <SearchableSelect
                  options={positionFilterOptions}
                  value={positionFilter}
                  onValueChange={onPositionFilterChange}
                  placeholder="Alle Bereiche"
                  searchPlaceholder="Bereich suchen…"
                  aria-label="Bereich filtern"
                  className={appSelectTriggerAccentCn(staffDrawerFieldClassName)}
                />
              </div>

              <Separator />
            </>
          ) : null}

          <div className="space-y-3">
            <Label
              htmlFor="shift-plan-filter-sort"
              className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
            >
              Sortierung
            </Label>
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
          </div>
        </div>

        <Separator />

        <div className="flex gap-3 px-6 py-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <Button
            type="button"
            variant="outline"
            className="h-12 flex-1 rounded-xl tap-scale"
            onClick={resetFilters}
          >
            Zurücksetzen
          </Button>
          <Button
            type="button"
            className={cn("h-12 flex-1", brandActionButtonRoundedClassName)}
            onClick={() => onOpenChange(false)}
          >
            Fertig
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
