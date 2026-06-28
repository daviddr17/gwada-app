"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import {
  moduleDataTableHeadCellClassName,
  moduleDataTableHeadLabelClassName,
  moduleDataTableHeadSortButtonCn,
} from "@/lib/ui/module-data-table";
import {
  moduleTableStickyHeadCellClassName,
  useModuleTableHorizontalScroll,
} from "@/lib/ui/module-table-sticky-column";
import { cn } from "@/lib/utils";

export type ModuleTableSortDir = "asc" | "desc";

/** Nicht sortierbarer Spaltenkopf — gleiche Typo wie Sort-Header. */
export function ModuleTableStaticColumnHeader({
  label,
  className,
  align = "left",
  stickyIdentityColumn = false,
}: {
  label: string;
  className?: string;
  align?: "left" | "right" | "center";
  /** Bei horizontalem Scroll links fixieren (z. B. Titel/Name). */
  stickyIdentityColumn?: boolean;
}) {
  const canScrollX = useModuleTableHorizontalScroll();

  return (
    <th
      className={moduleTableStickyHeadCellClassName(
        stickyIdentityColumn && canScrollX,
        cn(
          moduleDataTableHeadCellClassName,
          align === "right" && "text-right",
          align === "center" && "text-center",
          className,
        ),
      )}
    >
      <span className={moduleDataTableHeadLabelClassName}>{label}</span>
    </th>
  );
}

export function ModuleTableSortHeader<T extends string>({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
  className,
  ariaLabel,
  align = "left",
  stickyIdentityColumn = false,
}: {
  label: string;
  sortKey: T;
  activeKey: T | null;
  dir: ModuleTableSortDir;
  onSort: (key: T) => void;
  className?: string;
  ariaLabel?: string;
  align?: "left" | "right";
  stickyIdentityColumn?: boolean;
}) {
  const active = activeKey === sortKey;
  const canScrollX = useModuleTableHorizontalScroll();
  return (
    <th
      className={moduleTableStickyHeadCellClassName(
        stickyIdentityColumn && canScrollX,
        cn(
          moduleDataTableHeadCellClassName,
          align === "right" && "text-right",
          className,
        ),
      )}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        aria-label={ariaLabel ?? `${label} sortieren`}
        className={cn(
          moduleDataTableHeadSortButtonCn(active),
          align === "right" && "ml-auto",
        )}
      >
        <span>{label}</span>
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
