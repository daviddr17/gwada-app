"use client";

import * as React from "react";
import { MenuItemCompactRow } from "@/components/menu/menu-item-compact-row";
import { SortableDragOverlay } from "@/components/ui/sortable-drag-overlay";
import { useSortableReorder } from "@/lib/hooks/use-sortable-reorder";
import type { MenuItem, MenuTaxonomyDefinition } from "@/lib/types/menu";
import { moduleDataTableHeadRowMutedClassName } from "@/lib/ui/module-data-table";

type MenuCompactItemsTableProps = {
  items: MenuItem[];
  tagDefinitions: readonly MenuTaxonomyDefinition[];
  currencyCode?: string;
  /** Nur bei vollständiger Liste (ohne Such-/Filter-Auszug) sinnvoll. */
  sortable: boolean;
  onReorder: (orderedIds: string[]) => void;
  onSelect: (id: string) => void;
};

export function MenuCompactItemsTable({
  items,
  tagDefinitions,
  currencyCode,
  sortable,
  onReorder,
  onSelect,
}: MenuCompactItemsTableProps) {
  const ordered = items;
  const itemIds = React.useMemo(() => ordered.map((i) => i.id), [ordered]);

  const sort = useSortableReorder({
    itemIds,
    disabled: !sortable,
    onReorder: ({ fromIndex, toIndex }) => {
      const ids = ordered.map((i) => i.id);
      const nextIds = [...ids];
      const [removed] = nextIds.splice(fromIndex, 1);
      nextIds.splice(toIndex, 0, removed);
      onReorder(nextIds);
    },
  });

  return (
    <>
    <div className="overflow-x-auto rounded-xl border border-border/50 bg-card shadow-none dark:shadow-sm">
      <table className="w-full min-w-[320px] text-sm">
        <thead>
          <tr className={moduleDataTableHeadRowMutedClassName}>
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
          {ordered.map((item) => (
            <MenuItemCompactRow
              key={item.id}
              item={item}
              tagDefinitions={tagDefinitions}
              currencyCode={currencyCode}
              onSelect={(row) => onSelect(row.id)}
              sortable={sortable}
              itemRef={(el) => sort.registerItemRef(item.id, el)}
              itemClassName={sort.getItemDropClassName(item.id)}
              handleProps={sortable ? sort.getHandleProps(item.id) : undefined}
            />
          ))}
        </tbody>
      </table>
    </div>
    {sortable ? (
      <SortableDragOverlay
        activeId={sort.activeId}
        dragLayout={sort.dragLayout}
        showGapLine={sort.wouldReorder}
        renderGhost={(id) => {
          const item = ordered.find((i) => i.id === id);
          if (!item) return null;
          return (
            <div className="flex items-center gap-2 px-3 py-2.5 text-sm">
              <span className="w-8 text-muted-foreground tabular-nums">
                {item.listNumber ?? "–"}
              </span>
              <span className="min-w-0 flex-1 truncate font-medium">
                {item.name}
              </span>
            </div>
          );
        }}
      />
    ) : null}
    </>
  );
}
