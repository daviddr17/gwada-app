"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

export type SuperadminColumn<T> = {
  id: string;
  header: string;
  className?: string;
  cell: (row: T) => ReactNode;
  /** Wert für Sortierung (alle Spalten mit sortValue sind klickbar). */
  sortValue: (row: T) => string | number | boolean | null;
};

type SortDir = "asc" | "desc";

function compareSortValues(
  a: string | number | boolean | null,
  b: string | number | boolean | null,
  dir: SortDir,
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

export function SuperadminDataTable<T>({
  columns,
  rows,
  rowKey,
  emptyMessage,
  loading,
}: {
  columns: readonly SuperadminColumn<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string;
  emptyMessage: string;
  loading?: boolean;
}) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const toggleSort = (id: string) => {
    if (sortKey !== id) {
      setSortKey(id);
      setSortDir("asc");
      return;
    }
    setSortDir((d) => (d === "asc" ? "desc" : "asc"));
  };

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;
    const col = columns.find((c) => c.id === sortKey);
    if (!col) return rows;
    return [...rows].sort((ra, rb) =>
      compareSortValues(col.sortValue(ra), col.sortValue(rb), sortDir),
    );
  }, [rows, sortKey, sortDir, columns]);

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground" aria-busy>
        Daten werden geladen…
      </p>
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
          <tr className="border-b border-border/50 bg-muted/30">
            {columns.map((col) => (
              <th
                key={col.id}
                scope="col"
                className={cn(
                  "px-4 py-3 font-medium text-muted-foreground",
                  col.className,
                )}
              >
                <button
                  type="button"
                  onClick={() => toggleSort(col.id)}
                  className="inline-flex items-center gap-1 rounded-md px-0.5 py-0.5 text-left hover:bg-muted/60"
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
