"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

export type AccountingTableSortDir = "asc" | "desc";

export function AccountingTableSortHeader<T extends string>({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
  className,
  ariaLabel,
}: {
  label: string;
  sortKey: T;
  activeKey: T;
  dir: AccountingTableSortDir;
  onSort: (key: T) => void;
  className?: string;
  ariaLabel?: string;
}) {
  const active = activeKey === sortKey;
  return (
    <th className={cn("px-4 py-2", className)}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        aria-label={ariaLabel ?? (label || undefined)}
        className={cn(
          "inline-flex items-center gap-1 text-left text-xs font-medium tracking-wide uppercase transition-colors",
          active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
        )}
      >
        {label ? <span>{label}</span> : null}
        {active ? (
          dir === "asc" ? (
            <ArrowUp className="size-3.5 shrink-0 opacity-80" aria-hidden />
          ) : (
            <ArrowDown className="size-3.5 shrink-0 opacity-80" aria-hidden />
          )
        ) : null}
      </button>
    </th>
  );
}
