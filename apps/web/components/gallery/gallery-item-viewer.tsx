"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FeedMediaImage } from "@/components/feed/feed-media-image";
import { FeedVideoTile } from "@/components/feed/feed-video-tile";
import { galleryItemDisplayUrls } from "@/lib/gallery/gallery-item-display-urls";
import type { UnifiedGalleryItem } from "@/lib/gallery/unified-gallery-item";
import { cn } from "@/lib/utils";

type Props = {
  item: UnifiedGalleryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** Vollbild-Ansicht eines Galeriebilds/Videos (Profil-Sheet / Embed). */
export function GalleryItemViewer({ item, open, onOpenChange }: Props) {
  if (!item) return null;

  const { src, thumbSrc } = galleryItemDisplayUrls(item);
  const videoSrc = item.fullUrl?.trim() || item.previewUrl;
  const title = item.title?.trim() || item.caption?.trim() || "Galerie";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-h-[min(92dvh,56rem)] w-[min(100%-1.5rem,42rem)] gap-3 overflow-hidden p-3 sm:p-4",
        )}
        showCloseButton
      >
        <DialogHeader className="pr-8">
          <DialogTitle className="truncate text-base">{title}</DialogTitle>
        </DialogHeader>
        <div className="flex max-h-[min(70dvh,40rem)] items-center justify-center overflow-hidden rounded-xl bg-muted/30">
          {item.mediaKind === "video" ? (
            <FeedVideoTile
              src={videoSrc}
              className="aspect-auto max-h-[min(70dvh,40rem)] w-full object-contain"
            />
          ) : (
            <FeedMediaImage
              src={src}
              thumbSrc={thumbSrc}
              blurDataUrl={item.blurDataUrl}
              width={item.width}
              height={item.height}
              alt={title}
              fit="contain"
              className="max-h-[min(70dvh,40rem)] w-full"
              imgClassName="max-h-[min(70dvh,40rem)] w-full object-contain"
            />
          )}
        </div>
        {item.caption?.trim() && item.caption.trim() !== title ? (
          <p className="text-sm text-muted-foreground" data-embed-mt>
            {item.caption}
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
