"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import {
  moduleDataTableHeadCellClassName,
  moduleDataTableHeadSortButtonCn,
} from "@/lib/ui/module-data-table";
import {
  moduleTableStickyHeadCellClassName,
  useModuleTableHorizontalScroll,
} from "@/lib/ui/module-table-sticky-column";
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
  stickyIdentityColumn = false,
}: {
  label: string;
  sortKey: T;
  activeKey: T;
  dir: AccountingTableSortDir;
  onSort: (key: T) => void;
  className?: string;
  ariaLabel?: string;
  stickyIdentityColumn?: boolean;
}) {
  const active = activeKey === sortKey;
  const canScrollX = useModuleTableHorizontalScroll();
  return (
    <th
      className={moduleTableStickyHeadCellClassName(
        stickyIdentityColumn && canScrollX,
        cn(moduleDataTableHeadCellClassName, "py-2", className),
      )}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        aria-label={ariaLabel ?? (label || undefined)}
        className={moduleDataTableHeadSortButtonCn(active)}
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
