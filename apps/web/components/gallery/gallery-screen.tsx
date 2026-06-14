"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ListPaginationSurround } from "@/components/ui/list-pagination";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
import { GalleryCategoryFilterChips } from "@/components/gallery/gallery-category-filter-chips";
import { GalleryComposeDrawer } from "@/components/gallery/gallery-compose-drawer";
import { GalleryHighlightViewer } from "@/components/gallery/gallery-highlight-viewer";
import { GalleryHighlightsRow } from "@/components/gallery/gallery-highlights-row";
import { GalleryItemActionSheet } from "@/components/gallery/gallery-item-action-sheet";
import {
  GalleryMasonryGrid,
  GalleryMasonryGridSkeleton,
} from "@/components/gallery/gallery-masonry-grid";
import { GalleryPlatformFilterChips } from "@/components/gallery/gallery-platform-filter-chips";
import {
  GALLERY_CATEGORY_ALL,
  GALLERY_FILTER_ALL,
  type GalleryPlatformFilter,
} from "@/lib/constants/gallery-platforms";
import { GALLERY_FEED_PAGE_SIZE } from "@/lib/gallery/gallery-feed-pagination";
import type { GalleryFeedSyncMeta } from "@/lib/gallery/gallery-feed-sync-meta";
import type {
  GalleryCategoryOption,
  UnifiedGalleryHighlight,
  UnifiedGalleryItem,
} from "@/lib/gallery/unified-gallery-item";
import {
  clampListPage,
  totalPagesFromCount,
} from "@/lib/constants/list-pagination";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useGalleryPlatformConnections } from "@/lib/hooks/use-gallery-platform-connections";
import { useRestaurantPermissions } from "@/lib/hooks/use-restaurant-permissions";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { modulePrimaryAddButtonFullWidthClassName } from "@/lib/ui/module-primary-add-button";

export function GalleryScreen() {
  const { restaurantId, ready } = useWorkspaceRestaurantUuid();
  const { has } = useRestaurantPermissions();
  const canRead = has("gallery.read");
  const canCreate = has("gallery.create");
  const canUpdate = has("gallery.update");
  const canDelete = has("gallery.delete");

  const [platformFilter, setPlatformFilter] = useState<GalleryPlatformFilter>(GALLERY_FILTER_ALL);
  const [categoryFilter, setCategoryFilter] = useState<string>(GALLERY_CATEGORY_ALL);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<UnifiedGalleryItem[]>([]);
  const [highlights, setHighlights] = useState<UnifiedGalleryHighlight[]>([]);
  const [categories, setCategories] = useState<GalleryCategoryOption[]>([]);
  const [syncMeta, setSyncMeta] = useState<GalleryFeedSyncMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const showSkeleton = useDeferredSkeleton(loading && items.length === 0);

  const [composeOpen, setComposeOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<UnifiedGalleryItem | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeHighlight, setActiveHighlight] = useState<UnifiedGalleryHighlight | null>(null);
  const [highlightOpen, setHighlightOpen] = useState(false);

  const { availablePlatforms } = useGalleryPlatformConnections(restaurantId);

  const load = useCallback(async () => {
    if (!restaurantId || !canRead) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/gallery?${new URLSearchParams({ restaurantId })}`,
      );
      const data = (await res.json()) as {
        items?: UnifiedGalleryItem[];
        highlights?: UnifiedGalleryHighlight[];
        categories?: GalleryCategoryOption[];
        sync?: GalleryFeedSyncMeta;
        error?: string;
      };
      if (!res.ok) {
        toast.error("Galerie konnte nicht geladen werden");
        return;
      }
      setItems(data.items ?? []);
      setHighlights(data.highlights ?? []);
      setCategories(data.categories ?? []);
      setSyncMeta(data.sync ?? null);
    } finally {
      setLoading(false);
    }
  }, [restaurantId, canRead]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
    setCategoryFilter(GALLERY_CATEGORY_ALL);
  }, [platformFilter]);

  const filtered = useMemo(() => {
    let list = platformFilter === GALLERY_FILTER_ALL
      ? items
      : items.filter((i) => i.platform === platformFilter);
    if (categoryFilter !== GALLERY_CATEGORY_ALL) {
      list = list.filter((i) => i.category === categoryFilter);
    }
    return list;
  }, [items, platformFilter, categoryFilter]);

  const totalPages = totalPagesFromCount(filtered.length, GALLERY_FEED_PAGE_SIZE);
  const currentPage = clampListPage(page, totalPages);
  const paginatedItems = useMemo(() => {
    const from = (currentPage - 1) * GALLERY_FEED_PAGE_SIZE;
    return filtered.slice(from, from + GALLERY_FEED_PAGE_SIZE);
  }, [filtered, currentPage]);

  const handleSync = useCallback(async () => {
    if (!restaurantId) return;
    setSyncing(true);
    try {
      await fetch("/api/gallery/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId }),
      });
      await load();
    } finally {
      setSyncing(false);
    }
  }, [restaurantId, load]);

  const handleDelete = useCallback(async () => {
    if (!restaurantId || !selectedItem) return;
    const gwadaId = selectedItem.itemId ?? selectedItem.externalId;
    const params = new URLSearchParams({
      restaurantId,
      platform: selectedItem.platform,
      externalId: selectedItem.externalId,
    });
    const res = await fetch(`/api/gallery/items/${gwadaId}?${params.toString()}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast.error("Löschen fehlgeschlagen");
      return;
    }
    toast.success("Entfernt");
    setSheetOpen(false);
    setSelectedItem(null);
    void load();
  }, [restaurantId, selectedItem, load]);

  if (!ready) return <WorkspaceRestaurantResolvePlaceholder />;
  if (!restaurantId) return <WorkspaceRestaurantMissingMessage />;
  if (!canRead) {
    return (
      <p className="px-4 py-8 text-sm text-muted-foreground">
        Keine Berechtigung für die Galerie.
      </p>
    );
  }

  return (
    <div className="space-y-4 px-4 pb-8 sm:px-6">
      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="rounded-full border-border/60"
          disabled={syncing}
          onClick={() => void handleSync()}
          aria-label="Galerie synchronisieren"
        >
          <RefreshCw className={syncing ? "size-4 animate-spin" : "size-4"} />
        </Button>
      </div>

      <GalleryPlatformFilterChips
        value={platformFilter}
        onChange={setPlatformFilter}
        availablePlatforms={availablePlatforms}
      />

      <GalleryCategoryFilterChips
        value={categoryFilter}
        onChange={setCategoryFilter}
        categories={categories}
        platformFilter={platformFilter}
      />

      <GalleryHighlightsRow
        highlights={highlights}
        onHighlightClick={(h) => {
          setActiveHighlight(h);
          setHighlightOpen(true);
        }}
      />

      {canCreate ? (
        <Button
          type="button"
          size="lg"
          className={modulePrimaryAddButtonFullWidthClassName}
          onClick={() => setComposeOpen(true)}
        >
          <Plus className="size-4" />
          Bild hinzufügen
        </Button>
      ) : null}

      <ListPaginationSurround
        classNameAbove="pt-2"
        classNameBelow="pb-2"
        page={currentPage}
        totalPages={totalPages}
        shown={paginatedItems.length}
        totalCount={filtered.length}
        itemLabel="Bilder"
        canPrevious={currentPage > 1}
        canNext={currentPage < totalPages}
        onPrevious={() => setPage((p) => Math.max(1, p - 1))}
        onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
      >
        {showSkeleton ? (
          <GalleryMasonryGridSkeleton />
        ) : paginatedItems.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {syncMeta?.stale ? "Synchronisiere Galerie …" : "Noch keine Bilder in dieser Ansicht."}
          </p>
        ) : (
          <GalleryMasonryGrid
            items={paginatedItems}
            onItemClick={(item) => {
              setSelectedItem(item);
              setSheetOpen(true);
            }}
          />
        )}
      </ListPaginationSurround>

      <GalleryComposeDrawer
        open={composeOpen}
        onOpenChange={setComposeOpen}
        restaurantId={restaurantId}
        onSaved={() => void load()}
      />

      <GalleryItemActionSheet
        item={selectedItem}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        canUpdate={canUpdate}
        canDelete={canDelete}
        onEdit={() => toast.message("Bearbeiten folgt in Kürze")}
        onDelete={() => void handleDelete()}
      />

      <GalleryHighlightViewer
        highlight={activeHighlight}
        open={highlightOpen}
        onOpenChange={setHighlightOpen}
      />
    </div>
  );
}
