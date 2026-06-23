"use client";

import { useMemo } from "react";
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "@/components/ui/combobox";

const NO_STAFF = "__none__";

export type DocumentStaffOption = {
  id: string;
  label: string;
};

type DocumentStaffSelectProps = {
  staffMembers: readonly DocumentStaffOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  "aria-label"?: string;
};

export function DocumentStaffSelect({
  staffMembers,
  value,
  onValueChange,
  placeholder = "Kein Mitarbeiter",
  searchPlaceholder = "Mitarbeiter suchen …",
  "aria-label": ariaLabel,
}: DocumentStaffSelectProps) {
  const options = useMemo((): SearchableSelectOption[] => {
    const none: SearchableSelectOption = {
      value: NO_STAFF,
      label: "Kein Mitarbeiter",
    };
    return [
      none,
      ...staffMembers.map((m) => ({
        value: m.id,
        label: m.label,
      })),
    ];
  }, [staffMembers]);

  return (
    <SearchableSelect
      options={options}
      value={value}
      onValueChange={onValueChange}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      aria-label={ariaLabel}
    />
  );
}

export { NO_STAFF as DOCUMENT_STAFF_NONE };
