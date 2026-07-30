"use client";

import { DrawerFilterFooter } from "@/components/ui/drawer-filter-footer";
import {
  Drawer,
  DrawerContent,
} from "@/components/ui/drawer";
import {
  DrawerFilterField,
  DrawerFilterHeader,
  DrawerFilterZone,
} from "@/components/ui/drawer-filter-sheet";
import { DatePickerField } from "@/components/ui/date-picker";
import { SearchableSelect } from "@/components/ui/combobox";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { drawerScrollAreaClassName } from "@/lib/ui/drawer-form-section";

export type PosListFilterSelectOption = {
  value: string;
  label: string;
};

type PosListFilterDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  fromYmd: string;
  toYmd: string;
  onFromYmdChange: (ymd: string) => void;
  onToYmdChange: (ymd: string) => void;
  selectLabel?: string;
  selectValue?: string;
  selectOptions?: PosListFilterSelectOption[];
  onSelectChange?: (value: string) => void;
  onReset: () => void;
};

export function PosListFilterDrawer({
  open,
  onOpenChange,
  title = "Filter",
  fromYmd,
  toYmd,
  onFromYmdChange,
  onToYmdChange,
  selectLabel = "Status",
  selectValue,
  selectOptions,
  onSelectChange,
  onReset,
}: PosListFilterDrawerProps) {
  const showSelect =
    Boolean(selectOptions?.length) &&
    selectValue != null &&
    typeof onSelectChange === "function";

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      direction="bottom"
      repositionInputs={false}
    >
      <DrawerContent className={drawerContentClassName("template")}>
        <DrawerFilterHeader title={title} />

        <div className={drawerScrollAreaClassName(6)}>
          <DrawerFilterZone showLabel={title !== "Filter"}>
            <DrawerFilterField label="Von">
              <DatePickerField
                id="pos-list-filter-from"
                value={fromYmd}
                onChange={(v) => onFromYmdChange(v ?? fromYmd)}
                fullWidth
              />
            </DrawerFilterField>
            <DrawerFilterField label="Bis">
              <DatePickerField
                id="pos-list-filter-to"
                value={toYmd}
                onChange={(v) => onToYmdChange(v ?? toYmd)}
                minYmd={fromYmd}
                fullWidth
              />
            </DrawerFilterField>

            {showSelect ? (
              <DrawerFilterField label={selectLabel}>
                <SearchableSelect
                  value={selectValue}
                  onValueChange={onSelectChange}
                  options={selectOptions ?? []}
                  placeholder={selectLabel}
                  searchPlaceholder="Suchen…"
                  emptyText="Keine Option"
                  className="w-full"
                  aria-label={selectLabel}
                />
              </DrawerFilterField>
            ) : null}
          </DrawerFilterZone>
        </div>

        <DrawerFilterFooter
          onReset={onReset}
          onDone={() => onOpenChange(false)}
        />
      </DrawerContent>
    </Drawer>
  );
}

export function countPosDateRangeFilters(input: {
  fromYmd: string;
  toYmd: string;
  defaultFromYmd: string;
  defaultToYmd: string;
  selectValue: string;
  defaultSelectValue?: string;
}): number {
  let n = 0;
  if (
    input.fromYmd !== input.defaultFromYmd ||
    input.toYmd !== input.defaultToYmd
  ) {
    n += 1;
  }
  if (input.selectValue !== (input.defaultSelectValue ?? "all")) {
    n += 1;
  }
  return n;
}
