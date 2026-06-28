"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { SuperadminDataTableSkeleton } from "@/components/superadmin/superadmin-data-table-skeleton";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { cn } from "@/lib/utils";
import {
  moduleDataTableHeadCellClassName,
  moduleDataTableHeadRowMutedClassName,
  moduleDataTableHeadSortButtonCn,
} from "@/lib/ui/module-data-table";

export type SuperadminColumn<T> = {
  id: string;
  header: string;
  className?: string;
  cell: (row: T) => ReactNode;
  /** Wert für Sortierung (alle Spalten mit sortValue sind klickbar). */
  sortValue: (row: T) => string | number | boolean | null;
};

export type SuperadminSortDir = "asc" | "desc";

function compareSortValues(
  a: string | number | boolean | null,
  b: string | number | boolean | null,
  dir: SuperadminSortDir,
): number {
  const mult = dir === "asc" ? 1 : -1;
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") {
    return (a - b) * mult;
  }
  if (typeof a === "boolean" && typeof b === "boolean") {
    return (Number(a) - Number(b)) * mult;
  }
  return String(a).localeCompare(String(b), "de", { numeric: true }) * mult;
}

export function sortSuperadminRows<T>(
  rows: readonly T[],
  columns: readonly SuperadminColumn<T>[],
  sortKey: string | null,
  sortDir: SuperadminSortDir,
): T[] {
  if (!sortKey) return [...rows];
  const col = columns.find((c) => c.id === sortKey);
  if (!col) return [...rows];
  return [...rows].sort((ra, rb) =>
    compareSortValues(col.sortValue(ra), col.sortValue(rb), sortDir),
  );
}

export function SuperadminDataTable<T>({
  columns,
  rows,
  rowKey,
  emptyMessage,
  loading,
  sortKey: controlledSortKey,
  sortDir: controlledSortDir,
  onToggleSort,
}: {
  columns: readonly SuperadminColumn<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string;
  emptyMessage: string;
  loading?: boolean;
  sortKey?: string | null;
  sortDir?: SuperadminSortDir;
  onToggleSort?: (id: string) => void;
}) {
  const [internalSortKey, setInternalSortKey] = useState<string | null>(null);
  const [internalSortDir, setInternalSortDir] = useState<SuperadminSortDir>("asc");
  const showSkeleton = useDeferredSkeleton(loading ?? false);

  const sortKey = controlledSortKey ?? internalSortKey;
  const sortDir = controlledSortDir ?? internalSortDir;

  const toggleSort = (id: string) => {
    if (onToggleSort) {
      onToggleSort(id);
      return;
    }
    if (internalSortKey !== id) {
      setInternalSortKey(id);
      setInternalSortDir("asc");
      return;
    }
    setInternalSortDir((d) => (d === "asc" ? "desc" : "asc"));
  };

  const sortedRows = useMemo(
    () =>
      onToggleSort
        ? rows
        : sortSuperadminRows(rows, columns, sortKey, sortDir),
    [rows, columns, sortKey, sortDir, onToggleSort],
  );

  if (loading && showSkeleton) {
    return <SuperadminDataTableSkeleton columnCount={columns.length} />;
  }

  if (loading) {
    return (
      <div
        className="min-h-[12rem] rounded-xl border border-border/50 bg-card shadow-card"
        aria-busy="true"
      />
    );
  }

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border/60 px-4 py-8 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border/50 bg-card shadow-card">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <thead>
          <tr className={moduleDataTableHeadRowMutedClassName}>
            {columns.map((col) => (
              <th
                key={col.id}
                scope="col"
                className={cn(moduleDataTableHeadCellClassName, col.className)}
              >
                <button
                  type="button"
                  onClick={() => toggleSort(col.id)}
                  className={moduleDataTableHeadSortButtonCn(sortKey === col.id, "normal-case")}
                >
                  {col.header}
                  {sortKey === col.id ? (
                    sortDir === "asc" ? (
                      <ArrowUp className="size-3.5 shrink-0 opacity-70" />
                    ) : (
                      <ArrowDown className="size-3.5 shrink-0 opacity-70" />
                    )
                  ) : null}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => (
            <tr
              key={rowKey(row)}
              className="border-b border-border/40 last:border-0 hover:bg-muted/20"
            >
              {columns.map((col) => (
                <td key={col.id} className={cn("px-4 py-3", col.className)}>
                  {col.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
