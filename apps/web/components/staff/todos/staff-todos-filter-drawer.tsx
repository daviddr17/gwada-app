"use client";

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
import type { StaffTodoComputedStatus, StaffTodoPriority } from "@/lib/types/staff-todos";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import { STAFF_TODO_PRIORITY_LABELS, STAFF_TODO_PRIORITY_COLORS } from "@/lib/types/staff-todos";
import { STAFF_TODO_STATUS_LABELS } from "@/lib/staff/staff-todo-status";

const selectClass = appSelectTriggerAccentCn(staffDrawerFieldClassName);

type StaffTodosFilterDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filterStatus: string;
  onFilterStatusChange: (value: string) => void;
  filterPriority: string;
  onFilterPriorityChange: (value: string) => void;
  filterAssignee: string;
  onFilterAssigneeChange: (value: string) => void;
  assigneeOptions: { value: string; label: string }[];
  filterAreaId: string | null;
  onFilterAreaIdChange: (value: string | null) => void;
  areaOptions: { value: string; label: string }[];
  filterDeviceId: string | null;
  onFilterDeviceIdChange: (value: string | null) => void;
  deviceOptions: { value: string; label: string }[];
};

export function countStaffTodosActiveFilters(input: {
  filterStatus: string;
  filterPriority: string;
  filterAssignee: string;
  filterAreaId: string | null;
  filterDeviceId: string | null;
}): number {
  let n = 0;
  if (input.filterStatus !== "all") n += 1;
  if (input.filterPriority !== "all") n += 1;
  if (input.filterAssignee !== "all") n += 1;
  if (input.filterAreaId) n += 1;
  if (input.filterDeviceId) n += 1;
  return n;
}

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "Alle Status" },
  ...(
    Object.entries(STAFF_TODO_STATUS_LABELS) as [StaffTodoComputedStatus, string][]
  )
    .filter(([k]) => k !== "archived")
    .map(([value, label]) => ({ value, label })),
];

const PRIORITY_OPTIONS: { value: string; label: string; leadingColor?: string }[] = [
  { value: "all", label: "Alle Prioritäten" },
  ...(
    Object.entries(STAFF_TODO_PRIORITY_LABELS) as [StaffTodoPriority, string][]
  ).map(([value, label]) => ({
    value,
    label,
    leadingColor: STAFF_TODO_PRIORITY_COLORS[value],
  })),
];

export function StaffTodosFilterDrawer({
  open,
  onOpenChange,
  filterStatus,
  onFilterStatusChange,
  filterPriority,
  onFilterPriorityChange,
  filterAssignee,
  onFilterAssigneeChange,
  assigneeOptions,
  filterAreaId,
  onFilterAreaIdChange,
  areaOptions,
  filterDeviceId,
  onFilterDeviceIdChange,
  deviceOptions,
}: StaffTodosFilterDrawerProps) {
  const reset = () => {
    onFilterStatusChange("all");
    onFilterPriorityChange("all");
    onFilterAssigneeChange("all");
    onFilterAreaIdChange(null);
    onFilterDeviceIdChange(null);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom" repositionInputs={false}>
      <DrawerContent className={drawerContentClassName("filter")}>
        <DrawerHeader className={drawerFormHeaderClassName(6)}>
          <DrawerTitle>Filter</DrawerTitle>
          <DrawerDescription>
            Status, Priorität, Bereich, Gerät und Zuordnung.
          </DrawerDescription>
        </DrawerHeader>
        <div className={drawerScrollAreaClassName(6)}>
          <DrawerFormSection title="Status">
            <SearchableSelect
              value={filterStatus}
              onValueChange={onFilterStatusChange}
              options={STATUS_OPTIONS}
              className={selectClass}
            />
          </DrawerFormSection>
          <DrawerFormSection title="Priorität">
            <SearchableSelect
              value={filterPriority}
              onValueChange={onFilterPriorityChange}
              options={PRIORITY_OPTIONS}
              className={selectClass}
            />
          </DrawerFormSection>
          <DrawerFormSection title="Zuordnung">
            <SearchableSelect
              value={filterAssignee}
              onValueChange={onFilterAssigneeChange}
              options={assigneeOptions}
              className={selectClass}
            />
          </DrawerFormSection>
          {areaOptions.length > 1 ? (
            <DrawerFormSection title="Bereich">
              <SearchableSelect
                value={filterAreaId ?? "all"}
                onValueChange={(v) => onFilterAreaIdChange(v === "all" ? null : v)}
                options={areaOptions}
                className={selectClass}
              />
            </DrawerFormSection>
          ) : null}
          {deviceOptions.length > 1 ? (
            <DrawerFormSection title="Gerät">
              <SearchableSelect
                value={filterDeviceId ?? "all"}
                onValueChange={(v) => onFilterDeviceIdChange(v === "all" ? null : v)}
                options={deviceOptions}
                className={selectClass}
              />
            </DrawerFormSection>
          ) : null}
        </div>
        <DrawerFilterFooter onReset={reset} onDone={() => onOpenChange(false)} />
      </DrawerContent>
    </Drawer>
  );
}
