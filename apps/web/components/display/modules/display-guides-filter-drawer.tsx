"use client";

import { useMemo } from "react";
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

/** `"all"` = keine Filterung; `"none"` = ohne Kategorie. */
export type DisplayGuidesCategoryFilter = "all" | "none" | string;

type CategoryOption = { id: string; name: string };

type DisplayGuidesFilterDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filterCategory: DisplayGuidesCategoryFilter;
  onFilterCategoryChange: (value: DisplayGuidesCategoryFilter) => void;
  categories: CategoryOption[];
};

export function countDisplayGuidesActiveFilters(input: {
  filterCategory: DisplayGuidesCategoryFilter;
}): number {
  return input.filterCategory === "all" ? 0 : 1;
}

export function DisplayGuidesFilterDrawer({
  open,
  onOpenChange,
  filterCategory,
  onFilterCategoryChange,
  categories,
}: DisplayGuidesFilterDrawerProps) {
  const categoryOptions = useMemo(
    () => [
      { value: "all", label: "Alle Kategorien" },
      { value: "none", label: "Ohne Kategorie" },
      ...categories.map((c) => ({ value: c.id, label: c.name })),
    ],
    [categories],
  );

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom" repositionInputs={false}>
      <DrawerContent className={drawerContentClassName("filter")}>
        <DrawerFilterHeader title="Filter" />
        <div className={drawerScrollAreaClassName(6)}>
          <DrawerFilterZone showLabel={false}>
            <DrawerFilterField label="Kategorie">
              <SearchableSelect
                value={filterCategory}
                onValueChange={(v) =>
                  onFilterCategoryChange(
                    (v as DisplayGuidesCategoryFilter) || "all",
                  )
                }
                options={categoryOptions}
                className={selectClass}
              />
            </DrawerFilterField>
          </DrawerFilterZone>
        </div>
        <DrawerFilterFooter
          onReset={() => onFilterCategoryChange("all")}
          onDone={() => onOpenChange(false)}
        />
      </DrawerContent>
    </Drawer>
  );
}
