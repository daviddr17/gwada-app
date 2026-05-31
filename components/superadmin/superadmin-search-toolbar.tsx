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

export function SuperadminSearchToolbar({
  search,
  onSearchChange,
  searchPlaceholder,
  filterLabel,
  filterValue,
  filterOptions,
  onFilterChange,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder: string;
  filterLabel?: string;
  filterValue?: string;
  filterOptions?: readonly { value: string; label: string }[];
  onFilterChange?: (v: string) => void;
}) {
  const selectedFilterLabel =
    filterOptions?.find((o) => o.value === (filterValue ?? "all"))?.label ??
    filterLabel ??
    "Filter";

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
      {filterOptions && filterOptions.length > 0 && onFilterChange ? (
        <div className="flex shrink-0 items-center gap-2">
          {filterLabel ? (
            <span className="text-sm text-muted-foreground">{filterLabel}</span>
          ) : null}
          <Select
            value={filterValue ?? "all"}
            onValueChange={(v) => onFilterChange(String(v))}
          >
            <SelectTrigger
              className={appSelectTriggerAccentCn("h-9 min-w-[10rem]")}
            >
              <SelectValue>{selectedFilterLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {filterOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
    </div>
  );
}
