"use client";

import { DrawerFilterFooter } from "@/components/ui/drawer-filter-footer";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { drawerScrollAreaClassName } from "@/lib/ui/drawer-form-section";
import { SearchableSelect } from "@/components/ui/combobox";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import {
  DrawerFilterField,
  DrawerFilterHeader,
  DrawerFilterZone,
} from "@/components/ui/drawer-filter-sheet";
import { staffDrawerFieldClassName } from "@/components/staff/staff-form-field-styles";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";

const selectClass = appSelectTriggerAccentCn(staffDrawerFieldClassName);

export type GuidesActiveFilter = "all" | "active" | "inactive";

type GuidesFilterDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filterActive: GuidesActiveFilter;
  onFilterActiveChange: (value: GuidesActiveFilter) => void;
};

export function countGuidesActiveFilters(input: {
  filterActive: GuidesActiveFilter;
}): number {
  return input.filterActive === "all" ? 0 : 1;
}

const ACTIVE_OPTIONS: { value: GuidesActiveFilter; label: string }[] = [
  { value: "all", label: "Alle Status" },
  { value: "active", label: "Aktiv" },
  { value: "inactive", label: "Inaktiv" },
];

export function GuidesFilterDrawer({
  open,
  onOpenChange,
  filterActive,
  onFilterActiveChange,
}: GuidesFilterDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom" repositionInputs={false}>
      <DrawerContent className={drawerContentClassName("filter")}>
        <DrawerFilterHeader title="Filter" />
        <div className={drawerScrollAreaClassName(6)}>
          <DrawerFilterZone showLabel={false}>
            <DrawerFilterField label="Status">
              <SearchableSelect
                value={filterActive}
                onValueChange={(v) =>
                  onFilterActiveChange((v as GuidesActiveFilter) || "all")
                }
                options={ACTIVE_OPTIONS}
                className={selectClass}
              />
            </DrawerFilterField>
          </DrawerFilterZone>
        </div>
        <DrawerFilterFooter
          onReset={() => onFilterActiveChange("all")}
          onDone={() => onOpenChange(false)}
        />
      </DrawerContent>
    </Drawer>
  );
}
