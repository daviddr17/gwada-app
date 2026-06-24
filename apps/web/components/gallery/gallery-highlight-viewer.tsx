"use client";

import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import type { UnifiedGalleryHighlight } from "@/lib/gallery/unified-gallery-item";
import { GalleryMasonryGrid } from "@/components/gallery/gallery-masonry-grid";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { cn } from "@/lib/utils";

type Props = {
  highlight: UnifiedGalleryHighlight | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function GalleryHighlightViewer({
  highlight,
  open,
  onOpenChange,
}: Props) {
  if (!highlight) return null;

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom" repositionInputs={false}>
      <DrawerContent className={cn(drawerContentClassName("media"), "pb-safe")}>
        <DrawerHeader className="text-left">
          <DrawerTitle>{highlight.title}</DrawerTitle>
        </DrawerHeader>
        <div className="overflow-y-auto px-4 pb-6">
          <GalleryMasonryGrid
            items={highlight.items}
            onItemClick={() => undefined}
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
