"use client";

import { useMemo } from "react";
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "@/components/ui/combobox";
import { staffDrawerFieldClassName } from "@/components/staff/staff-form-field-styles";
import type { StaffPositionTagDefinition } from "@/lib/types/staff";
import { cn } from "@/lib/utils";

const NO_TAG = "__none__";

type StaffPositionTagSelectProps = {
  activeTags: StaffPositionTagDefinition[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  "aria-label"?: string;
};

export function StaffPositionTagSelect({
  activeTags,
  value,
  onValueChange,
  placeholder = "Keine Position",
  "aria-label": ariaLabel,
}: StaffPositionTagSelectProps) {
  const options = useMemo((): SearchableSelectOption[] => {
    return [
      { value: NO_TAG, label: "Keine Position" },
      ...activeTags.map((t) => ({
        value: t.id,
        label: t.name,
        leadingColor: t.backgroundColor,
      })),
    ];
  }, [activeTags]);

  return (
    <SearchableSelect
      options={options}
      value={value}
      onValueChange={onValueChange}
      placeholder={placeholder}
      searchPlaceholder="Position suchen …"
      aria-label={ariaLabel}
      className={cn(
        staffDrawerFieldClassName,
        "!min-h-11 !h-11 rounded-xl border-input",
      )}
    />
  );
}

export { NO_TAG as STAFF_POSITION_TAG_NONE };
