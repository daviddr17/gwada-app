"use client";

import { LayoutGrid } from "lucide-react";
import {
  GALLERY_FILTER_ALL,
  GALLERY_FILTER_LABELS,
  GALLERY_PLATFORM_ORDER,
  type GalleryPlatform,
  type GalleryPlatformFilter,
} from "@/lib/constants/gallery-platforms";
import { GalleryPlatformIcon } from "@/components/gallery/gallery-platform-icon";
import { cn } from "@/lib/utils";

type Props = {
  value: GalleryPlatformFilter;
  onChange: (value: GalleryPlatformFilter) => void;
  availablePlatforms: Set<GalleryPlatform>;
};

export function GalleryPlatformFilterChips({
  value,
  onChange,
  availablePlatforms,
}: Props) {
  const platforms = GALLERY_PLATFORM_ORDER.filter(
    (p) => p === "gwada" || availablePlatforms.has(p),
  );

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <GalleryPlatformChip
        selected={value === GALLERY_FILTER_ALL}
        label={GALLERY_FILTER_LABELS.all}
        onClick={() => onChange(GALLERY_FILTER_ALL)}
        icon={<LayoutGrid className="size-3.5 shrink-0 opacity-80" aria-hidden />}
      />
      {platforms.map((platform) => (
        <GalleryPlatformChip
          key={platform}
          selected={value === platform}
          label={GALLERY_FILTER_LABELS[platform]}
          onClick={() => onChange(platform)}
          icon={<GalleryPlatformIcon platform={platform} className="size-3.5" />}
        />
      ))}
    </div>
  );
}

function GalleryPlatformChip({
  selected,
  label,
  onClick,
  icon,
}: {
  selected: boolean;
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
        selected
          ? "border-accent/50 bg-accent/15 text-foreground"
          : "border-border/60 bg-background text-muted-foreground hover:border-border hover:text-foreground",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
