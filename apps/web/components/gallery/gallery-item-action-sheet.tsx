"use client";

import { ExternalLink, Pencil, Trash2 } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { FeedPinButton } from "@/components/feed-pin/feed-pin-button";
import { GALLERY_PLATFORM_LABELS } from "@/lib/constants/gallery-platforms";
import type { UnifiedGalleryItem } from "@/lib/gallery/unified-gallery-item";
import { GalleryPlatformIcon } from "@/components/gallery/gallery-platform-icon";

type Props = {
  item: UnifiedGalleryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canUpdate: boolean;
  canDelete: boolean;
  restaurantId: string;
  onEdit: () => void;
  onDelete: () => void;
  onChanged?: (nextPinned?: boolean) => void;
};

export function GalleryItemActionSheet({
  item,
  open,
  onOpenChange,
  canUpdate,
  canDelete,
  restaurantId,
  onEdit,
  onDelete,
  onChanged,
}: Props) {
  if (!item) return null;

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom" repositionInputs={false}>
      <DrawerContent className="pb-safe">
        <DrawerHeader className="text-left">
          <DrawerTitle className="flex items-center gap-2">
            <GalleryPlatformIcon platform={item.platform} />
            {item.title ?? item.categoryLabel ?? GALLERY_PLATFORM_LABELS[item.platform]}
          </DrawerTitle>
          {item.caption ? (
            <DrawerDescription className="line-clamp-3">{item.caption}</DrawerDescription>
          ) : null}
        </DrawerHeader>
        <div className="space-y-2 px-4 pb-6">
          <div className="overflow-hidden rounded-xl border border-border/50 bg-muted/20">
            {item.mediaKind === "video" ? (
              <video
                src={item.previewUrl}
                className="max-h-64 w-full object-contain"
                autoPlay
                muted
                loop
                playsInline
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.previewUrl} alt="" className="max-h-64 w-full object-contain" />
            )}
          </div>
          <div className="grid gap-2">
            {(canUpdate || canDelete) && restaurantId ? (
              <FeedPinButton
                restaurantId={restaurantId}
                module="gallery"
                platform={item.platform}
                itemId={item.id}
                isPinned={Boolean(item.isPinned)}
                className="w-full justify-start"
                onChanged={(nextPinned) => onChanged?.(nextPinned)}
              />
            ) : null}
            {item.externalUrl ? (
              <Button variant="outline" className="justify-start" render={<a href={item.externalUrl} target="_blank" rel="noopener noreferrer" />}>
                <ExternalLink className="size-4" />
                Auf {GALLERY_PLATFORM_LABELS[item.platform]} öffnen
              </Button>
            ) : null}
            {canUpdate && item.source === "gwada" ? (
              <Button variant="outline" className="justify-start" onClick={onEdit}>
                <Pencil className="size-4" />
                Bearbeiten
              </Button>
            ) : null}
            {canDelete && (item.canDelete || item.source === "gwada") ? (
              <Button variant="destructive" className="justify-start" onClick={onDelete}>
                <Trash2 className="size-4" />
                Löschen
              </Button>
            ) : null}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
