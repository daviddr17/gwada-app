"use client";

import { useMemo, useState } from "react";
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
import { GalleryHighlightAssignSection } from "@/components/gallery/gallery-highlight-assign-section";
import {
  ShareToChannelsSheet,
  ShareToChannelsTriggerButton,
} from "@/components/share/share-to-channels-sheet";
import { GALLERY_PLATFORM_LABELS } from "@/lib/constants/gallery-platforms";
import type { UnifiedGalleryItem } from "@/lib/gallery/unified-gallery-item";
import { GalleryPlatformIcon } from "@/components/gallery/gallery-platform-icon";
import { buildGalleryItemSharePayload } from "@/lib/share/share-payload-builders";
import { galleryItemDisplayUrls } from "@/lib/gallery/gallery-item-display-urls";

type Props = {
  item: UnifiedGalleryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canUpdate: boolean;
  canDelete: boolean;
  canShare?: boolean;
  restaurantId: string;
  restaurantName?: string;
  restaurantSlug?: string | null;
  onEdit: () => void;
  onDelete: () => void;
  onChanged?: (nextPinned?: boolean) => void;
  onHighlightsChanged?: () => void;
};

export function GalleryItemActionSheet({
  item,
  open,
  onOpenChange,
  canUpdate,
  canDelete,
  canShare = false,
  restaurantId,
  restaurantName = "Restaurant",
  restaurantSlug,
  onEdit,
  onDelete,
  onChanged,
  onHighlightsChanged,
}: Props) {
  const [shareOpen, setShareOpen] = useState(false);

  const sharePayload = useMemo(() => {
    if (!item) return null;
    const origin =
      typeof window !== "undefined" ? window.location.origin : undefined;
    return buildGalleryItemSharePayload({
      item,
      restaurantName,
      slug: restaurantSlug,
      origin,
    });
  }, [item, restaurantName, restaurantSlug]);

  if (!item) return null;

  const { src: displaySrc } = galleryItemDisplayUrls(item);
  const videoSrc = item.fullUrl?.trim() || item.previewUrl;

  return (
    <>
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
                src={videoSrc}
                className="max-h-64 w-full object-contain"
                autoPlay
                muted
                loop
                playsInline
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={displaySrc} alt="" className="max-h-64 w-full object-contain" />
            )}
          </div>
          <div className="grid gap-2">
            {canUpdate && item.source === "gwada" && item.itemId ? (
              <GalleryHighlightAssignSection
                restaurantId={restaurantId}
                itemId={item.itemId}
                storagePath={item.storagePath}
                open={open}
                onChanged={() => onHighlightsChanged?.()}
              />
            ) : canUpdate && item.source !== "gwada" ? (
              <p className="rounded-xl border border-border/50 bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
                Highlight-Ringe sind nur für eigene Gwada-Bilder verfügbar.
              </p>
            ) : null}
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
            {canShare && sharePayload ? (
              <ShareToChannelsTriggerButton
                className="w-full justify-start"
                onClick={() => setShareOpen(true)}
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

    {canShare && sharePayload ? (
      <ShareToChannelsSheet
        open={shareOpen}
        onOpenChange={setShareOpen}
        restaurantId={restaurantId}
        sourceType="gallery"
        payload={sharePayload}
      />
    ) : null}
    </>
  );
}
