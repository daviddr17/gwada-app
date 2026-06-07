"use client";

import { useMemo } from "react";
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "@/components/ui/combobox";
import type { DocumentTagDefinition } from "@/lib/types/documents";

const NO_TAG = "__none__";

type DocumentTagSelectProps = {
  activeTags: DocumentTagDefinition[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  "aria-label"?: string;
};

export function DocumentTagSelect({
  activeTags,
  value,
  onValueChange,
  placeholder = "Kein Tag",
  searchPlaceholder = "Tag suchen …",
  "aria-label": ariaLabel,
}: DocumentTagSelectProps) {
  const options = useMemo((): SearchableSelectOption[] => {
    const none: SearchableSelectOption = {
      value: NO_TAG,
      label: "Kein Tag",
    };
    return [
      none,
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
      searchPlaceholder={searchPlaceholder}
      aria-label={ariaLabel}
    />
  );
}

export { NO_TAG as DOCUMENT_TAG_NONE };
