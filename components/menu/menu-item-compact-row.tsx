"use client";

import { GripVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TAG_LABELS } from "@/lib/constants/menu-labels";
import { isMenuItemActive } from "@/lib/menu/item-utils";
import type { MenuItem } from "@/lib/types/menu";
import { getTagBadgeClass } from "@/lib/utils/tag-styles";
import { cn } from "@/lib/utils";

const priceFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

export type MenuItemCompactRowDragState = {
  draggingId: string | null;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
};

type MenuItemCompactRowProps = {
  item: MenuItem;
  onSelect?: (item: MenuItem) => void;
  /** Tabellen-Sortierung per Drag & Drop (wie Kategorien). */
  sortable?: boolean;
  dragState?: MenuItemCompactRowDragState;
};

export function MenuItemCompactRow({
  item,
  onSelect,
  sortable = false,
  dragState,
}: MenuItemCompactRowProps) {
  const live = isMenuItemActive(item);
  const canDrag = sortable && !!dragState;

  return (
    <tr
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onDragOver={canDrag && dragState ? dragState.onDragOver : undefined}
      onDrop={canDrag && dragState ? dragState.onDrop : undefined}
      onClick={() => onSelect?.(item)}
      onKeyDown={(e) => {
        if (onSelect && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onSelect(item);
        }
      }}
      className={cn(
        "border-b border-border/40 transition-colors last:border-0",
        onSelect &&
          (live
            ? "cursor-pointer hover:bg-muted/60"
            : "cursor-pointer hover:bg-destructive/12"),
        canDrag && dragState?.draggingId === item.id && "opacity-60",
        !live &&
          "bg-destructive/[0.07] text-foreground dark:bg-destructive/15",
      )}
    >
      {canDrag && dragState && (
        <td
          className="w-9 px-1 py-2.5 align-middle"
          onClick={(e) => e.stopPropagation()}
        >
          <span
            draggable
            onDragStart={(e) => {
              e.stopPropagation();
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", item.id);
              dragState.onDragStart();
            }}
            onDragEnd={(e) => {
              e.stopPropagation();
              dragState.onDragEnd();
            }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            className="inline-flex size-8 cursor-grab touch-none select-none items-center justify-center rounded-md border border-transparent text-muted-foreground hover:border-border/50 hover:bg-muted/50 active:cursor-grabbing"
            aria-label="Reihenfolge ändern"
          >
            <GripVertical className="size-4 shrink-0" />
          </span>
        </td>
      )}
      <td className="w-14 px-2 py-2.5 align-middle text-sm tabular-nums text-muted-foreground">
        {item.listNumber != null ? item.listNumber : "–"}
      </td>
      <td className="min-w-0 max-w-[1px] px-2 py-2.5 align-middle">
        <div className="min-w-0">
          <span className="block truncate font-medium">{item.name}</span>
          {item.description && (
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
              {item.description}
            </p>
          )}
        </div>
      </td>
      <td className="min-w-0 px-2 py-2.5 align-middle">
        <div className="flex flex-wrap items-center gap-1">
          {!live ? (
            <Badge
              variant="outline"
              className="h-6 shrink-0 rounded-full border-destructive/45 bg-destructive/12 px-2 text-[0.7rem] font-semibold text-destructive dark:bg-destructive/20"
              title="Gericht ist inaktiv"
            >
              Inaktiv
            </Badge>
          ) : null}
          {item.tags.map((tag) => (
            <Badge
              key={tag}
              variant="outline"
              className={cn(
                "h-5 rounded-full px-1.5 text-[0.65rem]",
                getTagBadgeClass(tag),
              )}
            >
              {TAG_LABELS[tag]}
            </Badge>
          ))}
        </div>
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-right align-middle font-semibold tabular-nums text-accent">
        {priceFormatter.format(item.price)}
      </td>
    </tr>
  );
}
