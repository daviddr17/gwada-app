"use client";

import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { isMenuItemActive } from "@/lib/menu/item-utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TAG_LABELS } from "@/lib/constants/menu-labels";
import type { MenuItem } from "@/lib/types/menu";
import { getTagBadgeClass } from "@/lib/utils/tag-styles";
import { cn } from "@/lib/utils";

const priceFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

type MenuItemCardProps = {
  item: MenuItem;
  onSelect?: (item: MenuItem) => void;
};

export function MenuItemCard({ item, onSelect }: MenuItemCardProps) {
  const live = isMenuItemActive(item);
  return (
    <Card
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
        "group/card tap-scale gap-0 overflow-hidden border-0 p-0 shadow-card",
        "ring-1 ring-border/40 transition-all duration-300",
        "hover:shadow-elevated hover:ring-accent/25",
        "active:shadow-card",
        onSelect && "cursor-pointer focus-visible:ring-2 focus-visible:ring-ring",
        !live && "opacity-[0.88]",
      )}
    >
      <div className="relative aspect-[5/4] overflow-hidden bg-muted">
        <Image
          src={item.imageUrl}
          alt={item.name}
          fill
          sizes="(max-width: 640px) 100vw, 33vw"
          className="object-cover transition-transform duration-500 ease-out group-hover/card:scale-[1.03]"
          loading="lazy"
        />
      </div>

      <CardHeader className="gap-1.5 px-5 pt-5 pb-0">
        <CardTitle className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-lg font-semibold leading-snug tracking-tight">
          {item.listNumber != null && (
            <span className="text-sm font-medium tabular-nums text-muted-foreground">
              {item.listNumber}.
            </span>
          )}
          <span>{item.name}</span>
          {!live && (
            <Badge variant="secondary" className="h-5 text-[0.65rem] font-medium">
              Inaktiv
            </Badge>
          )}
        </CardTitle>
        <CardDescription className="line-clamp-2 text-[0.9375rem] leading-relaxed">
          {item.description}
        </CardDescription>
      </CardHeader>

      {item.tags.length > 0 && (
        <CardContent className="flex flex-wrap gap-1.5 px-5 pt-3 pb-0">
          {item.tags.map((tag) => (
            <Badge
              key={tag}
              variant="outline"
              className={cn(
                "h-6 rounded-full border px-2.5 text-[0.6875rem] font-medium",
                getTagBadgeClass(tag),
              )}
            >
              {TAG_LABELS[tag]}
            </Badge>
          ))}
        </CardContent>
      )}

      <CardFooter className="mt-4 border-0 bg-transparent px-5 pt-2 pb-5">
        <p className="text-xl font-semibold tracking-tight text-accent tabular-nums">
          {priceFormatter.format(item.price)}
        </p>
      </CardFooter>
    </Card>
  );
}
