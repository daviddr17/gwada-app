"use client";

import { toast } from "sonner";
import { DrawerFilterFooter } from "@/components/ui/drawer-filter-footer";
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "@/components/ui/combobox";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import {
  DrawerFilterField,
  DrawerFilterHeader,
  DrawerFilterZone,
} from "@/components/ui/drawer-filter-sheet";
import { staffDrawerFieldClassName } from "@/components/staff/staff-form-field-styles";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { drawerScrollAreaClassName } from "@/lib/ui/drawer-form-section";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";

const selectClassName = appSelectTriggerAccentCn(staffDrawerFieldClassName);

type SuperadminNotificationLogFilterDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  moduleFilter: string;
  onModuleFilterChange: (value: string) => void;
  moduleOptions: SearchableSelectOption[];
  channelFilter: string;
  onChannelFilterChange: (value: string) => void;
  channelOptions: SearchableSelectOption[];
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  statusOptions: SearchableSelectOption[];
};

export function countSuperadminNotificationLogActiveFilters(input: {
  moduleFilter: string;
  channelFilter: string;
  statusFilter: string;
}): number {
  let n = 0;
  if (input.moduleFilter !== "all") n += 1;
  if (input.channelFilter !== "all") n += 1;
  if (input.statusFilter !== "all") n += 1;
  return n;
}

export function SuperadminNotificationLogFilterDrawer({
  open,
  onOpenChange,
  moduleFilter,
  onModuleFilterChange,
  moduleOptions,
  channelFilter,
  onChannelFilterChange,
  channelOptions,
  statusFilter,
  onStatusFilterChange,
  statusOptions,
}: SuperadminNotificationLogFilterDrawerProps) {
  const reset = () => {
    onModuleFilterChange("all");
    onChannelFilterChange("all");
    onStatusFilterChange("all");
    toast.success("Filter zurückgesetzt");
  };

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      direction="bottom"
      repositionInputs={false}
    >
      <DrawerContent className={drawerContentClassName("filter")}>
        <DrawerFilterHeader title="Filter" />
        <div className={drawerScrollAreaClassName(6)}>
          <DrawerFilterZone showLabel={false}>
            <DrawerFilterField label="Zweck">
              <SearchableSelect
                options={moduleOptions}
                value={moduleFilter}
                onValueChange={onModuleFilterChange}
                placeholder="Alle Zwecke"
                searchPlaceholder="Zweck …"
                aria-label="Zweck filtern"
                className={selectClassName}
              />
            </DrawerFilterField>
            <DrawerFilterField label="Kanal">
              <SearchableSelect
                options={channelOptions}
                value={channelFilter}
                onValueChange={onChannelFilterChange}
                placeholder="Alle Kanäle"
                searchPlaceholder="Kanal …"
                aria-label="Kanal filtern"
                className={selectClassName}
              />
            </DrawerFilterField>
            <DrawerFilterField label="Status">
              <SearchableSelect
                options={statusOptions}
                value={statusFilter}
                onValueChange={onStatusFilterChange}
                placeholder="Alle Status"
                searchPlaceholder="Status …"
                aria-label="Status filtern"
                className={selectClassName}
              />
            </DrawerFilterField>
          </DrawerFilterZone>
        </div>
        <DrawerFilterFooter onReset={reset} onDone={() => onOpenChange(false)} />
      </DrawerContent>
    </Drawer>
  );
}
