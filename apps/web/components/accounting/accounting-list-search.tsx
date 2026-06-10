"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  moduleSearchFieldWrapClassName,
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
}: {
  value: string;
  onDebouncedChange: (next: string) => void;
  placeholder: string;
  disabled?: boolean;
  hint?: string;
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
      </div>
      {hint && draft.trim() ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
