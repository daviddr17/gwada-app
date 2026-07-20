"use client";

import { DrawerFilterFooter } from "@/components/ui/drawer-filter-footer";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  DrawerFormBody,
  DrawerFormSection,
} from "@/components/ui/drawer-form-section";
import { DatePickerField } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/combobox";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import {
  drawerFormHeaderClassName,
  drawerScrollAreaClassName,
} from "@/lib/ui/drawer-form-section";

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
  description = "Zeitraum und weitere Filter für die Liste.",
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
        <DrawerHeader className={drawerFormHeaderClassName(6)}>
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            {title}
          </DrawerTitle>
          <DrawerDescription className="text-base">
            {description}
          </DrawerDescription>
        </DrawerHeader>

        <div className={drawerScrollAreaClassName(6)}>
          <DrawerFormBody>
            <DrawerFormSection title="Zeitraum">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="pos-list-filter-from">Von</Label>
                  <DatePickerField
                    id="pos-list-filter-from"
                    value={fromYmd}
                    onChange={(v) => onFromYmdChange(v ?? fromYmd)}
                    fullWidth
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pos-list-filter-to">Bis</Label>
                  <DatePickerField
                    id="pos-list-filter-to"
                    value={toYmd}
                    onChange={(v) => onToYmdChange(v ?? toYmd)}
                    minYmd={fromYmd}
                    fullWidth
                  />
                </div>
              </div>
            </DrawerFormSection>

            {showSelect ? (
              <DrawerFormSection title={selectLabel}>
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
              </DrawerFormSection>
            ) : null}
          </DrawerFormBody>
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
