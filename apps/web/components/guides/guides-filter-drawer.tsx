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
import type { RestaurantGuideCategoryRow } from "@/lib/types/guides";

const selectClass = appSelectTriggerAccentCn(staffDrawerFieldClassName);

export type GuidesActiveFilter = "all" | "active" | "inactive";

/** `"all"` = keine Kategorie-Filterung; `"none"` = ohne Kategorie. */
export type GuidesCategoryFilter = "all" | "none" | string;

type GuidesFilterDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filterActive: GuidesActiveFilter;
  onFilterActiveChange: (value: GuidesActiveFilter) => void;
  filterCategory: GuidesCategoryFilter;
  onFilterCategoryChange: (value: GuidesCategoryFilter) => void;
  categories: RestaurantGuideCategoryRow[];
};

export function countGuidesActiveFilters(input: {
  filterActive: GuidesActiveFilter;
  filterCategory: GuidesCategoryFilter;
}): number {
  let n = 0;
  if (input.filterActive !== "all") n += 1;
  if (input.filterCategory !== "all") n += 1;
  return n;
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
  filterCategory,
  onFilterCategoryChange,
  categories,
}: GuidesFilterDrawerProps) {
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
            <DrawerFilterField label="Kategorie">
              <SearchableSelect
                value={filterCategory}
                onValueChange={(v) =>
                  onFilterCategoryChange((v as GuidesCategoryFilter) || "all")
                }
                options={categoryOptions}
                className={selectClass}
              />
            </DrawerFilterField>
          </DrawerFilterZone>
        </div>
        <DrawerFilterFooter
          onReset={() => {
            onFilterActiveChange("all");
            onFilterCategoryChange("all");
          }}
          onDone={() => onOpenChange(false)}
        />
      </DrawerContent>
    </Drawer>
  );
}
