"use client";

import { useEffect, useState } from "react";
import { Filter, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  moduleSearchFieldWrapClassName,
  moduleSearchFilterActiveBadgeClassName,
  moduleSearchFilterButtonClassName,
  moduleSearchFilterButtonWrapClassName,
  moduleSearchFilterRowClassName,
  moduleSearchInputClassName,
} from "@/lib/ui/module-search-filter-toolbar";

const SEARCH_DEBOUNCE_MS = 300;

export function AccountingListSearch({
  value,
  onDebouncedChange,
  placeholder,
  disabled,
  hint,
  filterActiveCount = 0,
  onFilterClick,
}: {
  value: string;
  onDebouncedChange: (next: string) => void;
  placeholder: string;
  disabled?: boolean;
  hint?: string;
  filterActiveCount?: number;
  onFilterClick?: () => void;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (draft !== value) {
        onDebouncedChange(draft);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [draft, value, onDebouncedChange]);

  return (
    <div className="space-y-2">
      <div className={moduleSearchFilterRowClassName}>
        <div className={moduleSearchFieldWrapClassName}>
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
            className={moduleSearchInputClassName}
            disabled={disabled}
            aria-label={placeholder}
          />
        </div>
        {onFilterClick ? (
          <div className={moduleSearchFilterButtonWrapClassName}>
            <Button
              type="button"
              variant="outline"
              size="icon-lg"
              className={moduleSearchFilterButtonClassName}
              aria-label="Filter"
              disabled={disabled}
              onClick={onFilterClick}
            >
              <Filter className="size-4" />
            </Button>
            {filterActiveCount > 0 ? (
              <Badge
                variant="secondary"
                className={moduleSearchFilterActiveBadgeClassName}
              >
                {filterActiveCount}
              </Badge>
            ) : null}
          </div>
        ) : null}
      </div>
      {hint && draft.trim() ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
