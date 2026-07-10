"use client";

import { GripVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { labelForTagId } from "@/lib/constants/menu-labels";
import { isMenuItemActive } from "@/lib/menu/item-utils";
import { MenuItemAvailabilityBadge } from "@/components/menu/menu-item-availability-badge";
import type { UseSortableReorderResult } from "@/lib/hooks/use-sortable-reorder";
import type { MenuItem, MenuTaxonomyDefinition } from "@/lib/types/menu";
import { getTagChipVisual } from "@/lib/utils/tag-styles";
import { formatMenuPrice } from "@/lib/menu/format-menu-price";
import { cn } from "@/lib/utils";

type SortableHandleProps = ReturnType<
  UseSortableReorderResult<string>["getHandleProps"]
>;

type MenuItemCompactRowProps = {
  item: MenuItem;
  tagDefinitions: readonly MenuTaxonomyDefinition[];
  currencyCode?: string;
  onSelect?: (item: MenuItem) => void;
  sortable?: boolean;
  itemRef?: (el: HTMLTableRowElement | null) => void;
  itemClassName?: string;
  handleProps?: SortableHandleProps;
};

export function MenuItemCompactRow({
  item,
  tagDefinitions,
  currencyCode,
  onSelect,
  sortable = false,
  itemRef,
  itemClassName,
  handleProps,
}: MenuItemCompactRowProps) {
  const live = isMenuItemActive(item);
  const canDrag = sortable && !!handleProps;

  return (
    <tr
      ref={itemRef}
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onClick={() => onSelect?.(item)}
      onKeyDown={(e) => {
        if (onSelect && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onSelect(item);
        }
      }}
      className={cn(
        "border-b border-border/40 transition-[opacity,transform] duration-150 last:border-0",
        onSelect &&
          (live
            ? "cursor-pointer hover:bg-muted/60"
            : "cursor-pointer hover:bg-destructive/12"),
        !live &&
          "bg-destructive/[0.07] text-foreground dark:bg-destructive/15",
        itemClassName,
      )}
    >
      {canDrag && handleProps && (
        <td
          className="w-9 px-1 py-2.5 align-middle"
          onClick={(e) => e.stopPropagation()}
        >
          <span
            {...handleProps}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            className={cn(
              "inline-flex size-8 items-center justify-center rounded-md border border-transparent text-muted-foreground hover:border-border/50 hover:bg-muted/50",
              handleProps.className,
            )}
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
          <MenuItemAvailabilityBadge item={item} />
          {item.tags.map((tag) => {
            const vis = getTagChipVisual(tag, tagDefinitions);
            return (
              <Badge
                key={tag}
                variant="outline"
                className={cn(
                  "h-5 rounded-full px-1.5 text-[0.65rem]",
                  vis.className,
                )}
                style={vis.style}
              >
                {labelForTagId(tag, tagDefinitions)}
              </Badge>
            );
          })}
        </div>
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-right align-middle font-semibold tabular-nums text-accent">
        {formatMenuPrice(item.price, currencyCode)}
      </td>
    </tr>
  );
}
