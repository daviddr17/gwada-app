"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ListPaginationSurround } from "@/components/ui/list-pagination";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
import { GalleryCategoryFilterChips } from "@/components/gallery/gallery-category-filter-chips";
import { GalleryComposeDrawer } from "@/components/gallery/gallery-compose-drawer";
import { GalleryHighlightComposeDrawer } from "@/components/gallery/gallery-highlight-compose-drawer";
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
import {
  peekGalleryFeedCache,
  writeGalleryFeedCache,
} from "@/lib/gallery/gallery-feed-client-cache";
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
  const showSkeleton = useDeferredSkeleton(loading && items.length === 0);
  const loadGeneration = useRef(0);

  const [composeOpen, setComposeOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<UnifiedGalleryItem | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeHighlight, setActiveHighlight] = useState<UnifiedGalleryHighlight | null>(null);
  const [highlightOpen, setHighlightOpen] = useState(false);
  const [highlightComposeOpen, setHighlightComposeOpen] = useState(false);

  const { availablePlatforms } = useGalleryPlatformConnections(restaurantId);

  const load = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!restaurantId || !canRead) return;
      const generation = ++loadGeneration.current;
      const cached = peekGalleryFeedCache(restaurantId);
      const silent = options?.silent ?? false;

      if (!silent) {
        if (cached) {
          setItems(cached.items);
          setHighlights(cached.highlights);
          setCategories(cached.categories);
          setSyncMeta(cached.sync);
          setLoading(false);
        } else {
          setLoading(true);
        }
      }

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
        if (generation !== loadGeneration.current) return;
        if (!res.ok) {
          if (!silent && !cached) {
            toast.error("Galerie konnte nicht geladen werden");
          }
          return;
        }
        const nextItems = data.items ?? [];
        const nextHighlights = data.highlights ?? [];
        const nextCategories = data.categories ?? [];
        const nextSync = data.sync ?? null;
        setItems(nextItems);
        setHighlights(nextHighlights);
        setCategories(nextCategories);
        setSyncMeta(nextSync);
        writeGalleryFeedCache(restaurantId, {
          items: nextItems,
          highlights: nextHighlights,
          categories: nextCategories,
          sync: nextSync,
        });
      } finally {
        if (!silent && generation === loadGeneration.current) {
          setLoading(false);
        }
      }
    },
    [restaurantId, canRead],
  );

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

  const gwadaItemsForHighlights = useMemo(
    () =>
      items.filter(
        (item): item is UnifiedGalleryItem & { itemId: string } =>
          item.platform === "gwada" && Boolean(item.itemId),
      ),
    [items],
  );

  useEffect(() => {
    if (!syncMeta?.stale || loading) return;
    void load({ silent: true });
  }, [syncMeta?.stale, loading, load]);

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

  if (!ready) {
    return <WorkspaceRestaurantResolvePlaceholder className="min-h-[20rem]" />;
  }
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
      {syncMeta?.stale ? (
        <p className="text-xs text-muted-foreground">
          Externe Kanäle werden im Hintergrund synchronisiert …
        </p>
      ) : null}

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
        canManage={canUpdate}
        onAddHighlight={() => setHighlightComposeOpen(true)}
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
        {loading && items.length === 0 && !showSkeleton ? (
          <div
            className="min-h-[280px] rounded-2xl border border-border/50"
            aria-busy
            aria-label="Galerie wird geladen"
          />
        ) : showSkeleton ? (
          <GalleryMasonryGridSkeleton count={8} />
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

      <GalleryHighlightComposeDrawer
        open={highlightComposeOpen}
        onOpenChange={setHighlightComposeOpen}
        restaurantId={restaurantId}
        gwadaItems={gwadaItemsForHighlights}
        onSaved={() => void load()}
      />

      <GalleryHighlightViewer
        highlight={activeHighlight}
        open={highlightOpen}
        onOpenChange={setHighlightOpen}
      />
    </div>
  );
}
