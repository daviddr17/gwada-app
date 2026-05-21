"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type SuperadminColumn<T> = {
  id: string;
  header: string;
  className?: string;
  cell: (row: T) => ReactNode;
};

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
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
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
