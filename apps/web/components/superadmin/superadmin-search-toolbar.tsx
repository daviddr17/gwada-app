"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";

export type SuperadminToolbarFilter = {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (v: string) => void;
};

export function SuperadminSearchToolbar({
  search,
  onSearchChange,
  searchPlaceholder,
  filterLabel,
  filterValue,
  filterOptions,
  onFilterChange,
  extraFilters,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder: string;
  filterLabel?: string;
  filterValue?: string;
  filterOptions?: readonly { value: string; label: string }[];
  onFilterChange?: (v: string) => void;
  /** Weitere Selects rechts neben dem Primärfilter. */
  extraFilters?: readonly SuperadminToolbarFilter[];
}) {
  const filters: SuperadminToolbarFilter[] = [];
  if (filterOptions && filterOptions.length > 0 && onFilterChange) {
    filters.push({
      label: filterLabel ?? "Filter",
      value: filterValue ?? "all",
      options: filterOptions,
      onChange: onFilterChange,
    });
  }
  if (extraFilters?.length) filters.push(...extraFilters);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative min-w-0 flex-1 sm:max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="h-9 pl-9"
          aria-label="Suche"
        />
      </div>
      {filters.length > 0 ? (
        <div className="flex flex-wrap shrink-0 items-center gap-2">
          {filters.map((filter) => {
            const selectedLabel =
              filter.options.find((o) => o.value === filter.value)?.label ??
              filter.label;
            return (
              <div key={filter.label} className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {filter.label}
                </span>
                <Select
                  value={filter.value}
                  onValueChange={(v) => filter.onChange(String(v))}
                >
                  <SelectTrigger
                    className={appSelectTriggerAccentCn("h-9 min-w-[10rem]")}
                  >
                    <SelectValue>{selectedLabel}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {filter.options.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
