"use client";

import { LayoutGrid } from "lucide-react";
import type { GalleryCategoryOption } from "@/lib/gallery/unified-gallery-item";
import { GALLERY_CATEGORY_ALL } from "@/lib/constants/gallery-platforms";
import { GalleryPlatformIcon } from "@/components/gallery/gallery-platform-icon";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (value: string) => void;
  categories: GalleryCategoryOption[];
  platformFilter: string;
};

export function GalleryCategoryFilterChips({
  value,
  onChange,
  categories,
  platformFilter,
}: Props) {
  const visible =
    platformFilter === "all"
      ? categories
      : categories.filter((c) => c.platform === platformFilter);

  if (visible.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <button
        type="button"
        onClick={() => onChange(GALLERY_CATEGORY_ALL)}
        className={cn(
          "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
          value === GALLERY_CATEGORY_ALL
            ? "border-accent/50 bg-accent/15"
            : "border-border/60 text-muted-foreground hover:text-foreground",
        )}
      >
        <LayoutGrid className="size-3.5 opacity-80" aria-hidden />
        Alle Kategorien
      </button>
      {visible.map((category) => (
        <button
          key={`${category.platform}:${category.key}`}
          type="button"
          onClick={() => onChange(category.key)}
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
            value === category.key
              ? "border-accent/50 bg-accent/15"
              : "border-border/60 text-muted-foreground hover:text-foreground",
          )}
        >
          <GalleryPlatformIcon platform={category.platform} className="size-3.5" />
          {category.label}
          <span className="text-xs tabular-nums opacity-70">{category.count}</span>
        </button>
      ))}
    </div>
  );
}
