"use client";

import * as React from "react";
import { MenuItemCompactRow } from "@/components/menu/menu-item-compact-row";
import type { MenuItem } from "@/lib/types/menu";

type MenuCompactItemsTableProps = {
  items: MenuItem[];
  /** Nur bei vollständiger Liste (ohne Such-/Filter-Auszug) sinnvoll. */
  sortable: boolean;
  onReorder: (orderedIds: string[]) => void;
  onSelect: (id: string) => void;
};

export function MenuCompactItemsTable({
  items,
  sortable,
  onReorder,
  onSelect,
}: MenuCompactItemsTableProps) {
  const [dragId, setDragId] = React.useState<string | null>(null);

  const ordered = items;

  const move = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
    if (fromIndex >= ordered.length || toIndex >= ordered.length) return;
    const ids = ordered.map((i) => i.id);
    const nextIds = [...ids];
    const [removed] = nextIds.splice(fromIndex, 1);
    nextIds.splice(toIndex, 0, removed);
    onReorder(nextIds);
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-border/50 bg-card shadow-sm">
      <table className="w-full min-w-[320px] text-sm">
        <thead>
          <tr className="border-b border-border/60 bg-muted/40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {sortable && (
              <th className="w-9 px-1 py-2" aria-hidden />
            )}
            <th className="w-14 px-2 py-2">Nr.</th>
            <th className="min-w-0 px-2 py-2">Gericht</th>
            <th className="min-w-[5rem] px-2 py-2">Tags</th>
            <th className="px-3 py-2 text-right">Preis</th>
          </tr>
        </thead>
        <tbody>
          {ordered.map((item, index) => (
            <MenuItemCompactRow
              key={item.id}
              item={item}
              onSelect={(row) => onSelect(row.id)}
              sortable={sortable}
              dragState={
                sortable
                  ? {
                      draggingId: dragId,
                      onDragStart: () => setDragId(item.id),
                      onDragOver: (e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                      },
                      onDrop: (e) => {
                        e.preventDefault();
                        if (!dragId || dragId === item.id) return;
                        const from = ordered.findIndex((i) => i.id === dragId);
                        const to = index;
                        move(from, to);
                        setDragId(null);
                      },
                      onDragEnd: () => setDragId(null),
                    }
                  : undefined
              }
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
