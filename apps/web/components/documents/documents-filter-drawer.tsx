"use client";

import { useMemo } from "react";
import { DrawerFilterFooter } from "@/components/ui/drawer-filter-footer";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { drawerScrollAreaClassName } from "@/lib/ui/drawer-form-section";
import { DatePickerField } from "@/components/ui/date-picker";
import { SearchableSelect } from "@/components/ui/combobox";
import {
  Drawer,
  DrawerContent,
} from "@/components/ui/drawer";
import {
  DrawerFilterField,
  DrawerFilterHeader,
  DrawerFilterZone,
} from "@/components/ui/drawer-filter-sheet";
import { staffDrawerFieldClassName } from "@/components/staff/staff-form-field-styles";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import type { DocumentStaffOption } from "@/components/documents/document-staff-select";

const selectClass = appSelectTriggerAccentCn(staffDrawerFieldClassName);

export const DOCUMENTS_TAG_FILTER_ALL = "__all__";
export const DOCUMENTS_TAG_FILTER_UNTAGGED = "__untagged__";
export const DOCUMENTS_STAFF_FILTER_ALL = "__all__";
export const DOCUMENTS_STAFF_FILTER_NONE = "__none__";

type DocumentsFilterDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filterStaffId: string;
  onFilterStaffIdChange: (value: string) => void;
  staffMembers: DocumentStaffOption[];
  filterTag: string;
  onFilterTagChange: (value: string) => void;
  tagOptions: { value: string; label: string; leadingColor?: string }[];
  filterDateFrom: string | null;
  onFilterDateFromChange: (value: string | null) => void;
  filterDateTo: string | null;
  onFilterDateToChange: (value: string | null) => void;
};

export function countDocumentsActiveFilters(input: {
  filterStaffId: string;
  filterTag: string;
  filterDateFrom: string | null;
  filterDateTo: string | null;
}): number {
  let n = 0;
  if (input.filterStaffId !== DOCUMENTS_STAFF_FILTER_ALL) n += 1;
  if (input.filterTag !== DOCUMENTS_TAG_FILTER_ALL) n += 1;
  if (input.filterDateFrom || input.filterDateTo) n += 1;
  return n;
}

export function DocumentsFilterDrawer({
  open,
  onOpenChange,
  filterStaffId,
  onFilterStaffIdChange,
  staffMembers,
  filterTag,
  onFilterTagChange,
  tagOptions,
  filterDateFrom,
  onFilterDateFromChange,
  filterDateTo,
  onFilterDateToChange,
}: DocumentsFilterDrawerProps) {
  const staffOptions = useMemo(
    () => [
      { value: DOCUMENTS_STAFF_FILTER_ALL, label: "Alle Mitarbeiter" },
      { value: DOCUMENTS_STAFF_FILTER_NONE, label: "Ohne Mitarbeiter" },
      ...staffMembers.map((s) => ({ value: s.id, label: s.label })),
    ],
    [staffMembers],
  );

  const reset = () => {
    onFilterStaffIdChange(DOCUMENTS_STAFF_FILTER_ALL);
    onFilterTagChange(DOCUMENTS_TAG_FILTER_ALL);
    onFilterDateFromChange(null);
    onFilterDateToChange(null);
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
            <DrawerFilterField label="Mitarbeiter">
              <SearchableSelect
                options={staffOptions}
                value={filterStaffId}
                onValueChange={onFilterStaffIdChange}
                placeholder="Alle Mitarbeiter"
                searchPlaceholder="Mitarbeiter suchen …"
                aria-label="Nach Mitarbeiter filtern"
                className={selectClass}
              />
            </DrawerFilterField>
            <DrawerFilterField label="Tag">
              <SearchableSelect
                options={tagOptions}
                value={filterTag}
                onValueChange={onFilterTagChange}
                placeholder="Alle Tags"
                searchPlaceholder="Tag suchen …"
                aria-label="Nach Tag filtern"
                className={selectClass}
              />
            </DrawerFilterField>
            <DrawerFilterField label="Von">
              <DatePickerField
                id="documents-filter-date-from"
                value={filterDateFrom}
                onChange={(v) => {
                  onFilterDateFromChange(v);
                  if (v && filterDateTo && v > filterDateTo) {
                    onFilterDateToChange(null);
                  }
                }}
                placeholder="Beliebig"
                fullWidth
              />
            </DrawerFilterField>
            <DrawerFilterField label="Bis">
              <DatePickerField
                id="documents-filter-date-to"
                value={filterDateTo}
                onChange={onFilterDateToChange}
                placeholder="Beliebig"
                minYmd={filterDateFrom}
                fullWidth
              />
            </DrawerFilterField>
          </DrawerFilterZone>
        </div>
        <DrawerFilterFooter onReset={reset} onDone={() => onOpenChange(false)} />
      </DrawerContent>
    </Drawer>
  );
}
