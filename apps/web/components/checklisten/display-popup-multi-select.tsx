"use client";

import { useMemo } from "react";
import { SearchableMultiSelect } from "@/components/ui/combobox";
import {
  buildDisplayPopupOptions,
  displayPopupFlagsToIds,
  displayPopupIdsToFlags,
  type DisplayPopupFlags,
} from "@/lib/staff/display-popup-options";

type DisplayPopupMultiSelectProps = {
  flags: DisplayPopupFlags;
  onChange: (flags: DisplayPopupFlags) => void;
  includeAllowReopen?: boolean;
  blocksShiftEndLabel?: string;
  disabled?: boolean;
};

export function DisplayPopupMultiSelect({
  flags,
  onChange,
  includeAllowReopen = false,
  blocksShiftEndLabel,
  disabled,
}: DisplayPopupMultiSelectProps) {
  const options = useMemo(
    () =>
      buildDisplayPopupOptions({
        includeAllowReopen,
        blocksShiftEndLabel,
      }),
    [includeAllowReopen, blocksShiftEndLabel],
  );

  const value = useMemo(() => displayPopupFlagsToIds(flags), [flags]);

  return (
    <SearchableMultiSelect
      options={options}
      value={value}
      onChange={(ids) => onChange(displayPopupIdsToFlags(ids, flags))}
      disabled={disabled}
      placeholder="Popups & Regeln wählen …"
      searchPlaceholder="Weitere suchen …"
      aria-label="Popup am Display"
    />
  );
}
