"use client";

import { useMemo } from "react";
import { DrawerFilterFooter } from "@/components/ui/drawer-filter-footer";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import {
  drawerFormHeaderClassName,
  drawerScrollAreaClassName,
} from "@/lib/ui/drawer-form-section";
import { SearchableSelect } from "@/components/ui/combobox";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { DrawerFormSection } from "@/components/ui/drawer-form-section";
import { staffDrawerFieldClassName } from "@/components/staff/staff-form-field-styles";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import type {
  ChecklistProtocolDeviationFilter,
  ChecklistProtocolKindFilter,
  ChecklistProtocolPeriodFilter,
  ChecklistProtocolSortKey,
} from "@/lib/checklisten/checklist-protocol-entries";
import {
  CHECKLIST_PROTOCOL_DEFAULT_KIND,
  CHECKLIST_PROTOCOL_DEFAULT_PERIOD,
  CHECKLIST_PROTOCOL_DEVIATION_OPTIONS,
  CHECKLIST_PROTOCOL_KIND_OPTIONS,
  CHECKLIST_PROTOCOL_PERIOD_OPTIONS,
  CHECKLIST_PROTOCOL_SORT_OPTIONS,
  countChecklistProtocolActiveFilters,
} from "@/lib/checklisten/checklist-protocol-entries";
import type { ChecklistAreaDefinition } from "@/lib/types/checklist-areas-devices";
import type { RestaurantChecklistDeviceRow } from "@/lib/types/checklist-areas-devices";

const selectClass = appSelectTriggerAccentCn(staffDrawerFieldClassName);

type ChecklistProtocolFilterDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filterKind: ChecklistProtocolKindFilter;
  onFilterKindChange: (value: ChecklistProtocolKindFilter) => void;
  filterPeriod: ChecklistProtocolPeriodFilter;
  onFilterPeriodChange: (value: ChecklistProtocolPeriodFilter) => void;
  filterAreaId: string;
  onFilterAreaIdChange: (value: string) => void;
  filterDeviceId: string;
  onFilterDeviceIdChange: (value: string) => void;
  filterDeviation: ChecklistProtocolDeviationFilter;
  onFilterDeviationChange: (value: ChecklistProtocolDeviationFilter) => void;
  sortKey: ChecklistProtocolSortKey;
  onSortKeyChange: (value: ChecklistProtocolSortKey) => void;
  areas: ChecklistAreaDefinition[];
  devices: RestaurantChecklistDeviceRow[];
};

export { countChecklistProtocolActiveFilters };

export function ChecklistProtocolFilterDrawer({
  open,
  onOpenChange,
  filterKind,
  onFilterKindChange,
  filterPeriod,
  onFilterPeriodChange,
  filterAreaId,
  onFilterAreaIdChange,
  filterDeviceId,
  onFilterDeviceIdChange,
  filterDeviation,
  onFilterDeviationChange,
  sortKey,
  onSortKeyChange,
  areas,
  devices,
}: ChecklistProtocolFilterDrawerProps) {
  const areaOptions = useMemo(
    () => [
      { value: "all", label: "Alle Bereiche" },
      ...areas.filter((a) => a.active).map((a) => ({ value: a.id, label: a.name })),
    ],
    [areas],
  );

  const deviceOptions = useMemo(
    () => [
      { value: "all", label: "Alle Geräte" },
      ...devices
        .filter((d) => d.is_active)
        .map((d) => ({ value: d.id, label: d.name })),
    ],
    [devices],
  );

  const reset = () => {
    onFilterKindChange(CHECKLIST_PROTOCOL_DEFAULT_KIND);
    onFilterPeriodChange(CHECKLIST_PROTOCOL_DEFAULT_PERIOD);
    onFilterAreaIdChange("all");
    onFilterDeviceIdChange("all");
    onFilterDeviationChange("all");
    onSortKeyChange("newest");
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom" repositionInputs={false}>
      <DrawerContent className={drawerContentClassName("filter")}>
        <DrawerHeader className={drawerFormHeaderClassName(6)}>
          <DrawerTitle>Filter & Sortierung</DrawerTitle>
          <DrawerDescription>
            Zeitraum, Bereich, Gerät, Typ und Sortierung des Protokolls.
          </DrawerDescription>
        </DrawerHeader>
        <div className={drawerScrollAreaClassName(6)}>
          <DrawerFormSection title="Typ">
            <SearchableSelect
              value={filterKind}
              onValueChange={(v) => onFilterKindChange(v as ChecklistProtocolKindFilter)}
              options={CHECKLIST_PROTOCOL_KIND_OPTIONS}
              className={selectClass}
            />
          </DrawerFormSection>
          <DrawerFormSection title="Zeitraum">
            <SearchableSelect
              value={filterPeriod}
              onValueChange={(v) => onFilterPeriodChange(v as ChecklistProtocolPeriodFilter)}
              options={CHECKLIST_PROTOCOL_PERIOD_OPTIONS}
              className={selectClass}
            />
          </DrawerFormSection>
          <DrawerFormSection title="Bereich">
            <SearchableSelect
              value={filterAreaId}
              onValueChange={onFilterAreaIdChange}
              options={areaOptions}
              className={selectClass}
            />
          </DrawerFormSection>
          <DrawerFormSection title="Gerät">
            <SearchableSelect
              value={filterDeviceId}
              onValueChange={onFilterDeviceIdChange}
              options={deviceOptions}
              className={selectClass}
            />
          </DrawerFormSection>
          <DrawerFormSection title="Ergebnis">
            <SearchableSelect
              value={filterDeviation}
              onValueChange={(v) =>
                onFilterDeviationChange(v as ChecklistProtocolDeviationFilter)
              }
              options={CHECKLIST_PROTOCOL_DEVIATION_OPTIONS}
              className={selectClass}
            />
          </DrawerFormSection>
          <DrawerFormSection title="Sortierung">
            <SearchableSelect
              value={sortKey}
              onValueChange={(v) => onSortKeyChange(v as ChecklistProtocolSortKey)}
              options={CHECKLIST_PROTOCOL_SORT_OPTIONS}
              className={selectClass}
            />
          </DrawerFormSection>
        </div>
        <DrawerFilterFooter onReset={reset} onDone={() => onOpenChange(false)} />
      </DrawerContent>
    </Drawer>
  );
}
