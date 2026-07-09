"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
import { GalleryMasonryGrid } from "@/components/gallery/gallery-masonry-grid";
import { GalleryPlatformFilterChips } from "@/components/gallery/gallery-platform-filter-chips";
import {
  GALLERY_CATEGORY_ALL,
  GALLERY_FILTER_ALL,
  GALLERY_PLATFORM_LABELS,
  type GalleryPlatformFilter,
} from "@/lib/constants/gallery-platforms";
import { GALLERY_FEED_PAGE_SIZE } from "@/lib/gallery/gallery-feed-pagination";
import {
  peekGalleryFeedCache,
  writeGalleryFeedCache,
  type GalleryFeedCachePayload,
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
import { useGalleryPlatformConnections } from "@/lib/hooks/use-gallery-platform-connections";
import { useRestaurantPermissions } from "@/lib/hooks/use-restaurant-permissions";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { useRestaurantProfile } from "@/lib/contexts/restaurant-profile-context";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import { peekCachedWorkspaceRestaurantId } from "@/lib/supabase/workspace-persistence";
import { modulePrimaryAddButtonFullWidthClassName } from "@/lib/ui/module-primary-add-button";

const GALLERY_SYNC_POLL_MS = 5_000;
const GALLERY_SYNC_POLL_MAX = 3;

function initialGalleryRestaurantId(): string | null {
  if (typeof window === "undefined") return null;
  const cached = peekCachedWorkspaceRestaurantId();
  return cached && isUuidRestaurantId(cached) ? cached : null;
}

function initialGalleryFeedFromCache(restaurantId: string | null): {
  items: UnifiedGalleryItem[];
  highlights: UnifiedGalleryHighlight[];
  categories: GalleryCategoryOption[];
  syncMeta: GalleryFeedSyncMeta | null;
  loading: boolean;
} {
  if (!restaurantId) {
    return {
      items: [],
      highlights: [],
      categories: [],
      syncMeta: null,
      loading: true,
    };
  }
  const cached = peekGalleryFeedCache(restaurantId);
  if (!cached) {
    return {
      items: [],
      highlights: [],
      categories: [],
      syncMeta: null,
      loading: true,
    };
  }
  return {
    items: cached.items,
    highlights: cached.highlights,
    categories: cached.categories,
    syncMeta: cached.sync,
    loading: false,
  };
}

export function GalleryScreen() {
  const { restaurantId, ready } = useWorkspaceRestaurantUuid();
  const { getProfileForRestaurantId, isReady: profileReady } =
    useRestaurantProfile();
  const { has, loading: permissionsLoading } = useRestaurantPermissions();
  const canRead = has("gallery.read");
  const canCreate = has("gallery.create");
  const canUpdate = has("gallery.update");
  const canDelete = has("gallery.delete");

  const profile = useMemo(() => {
    if (!restaurantId || !profileReady) return null;
    return getProfileForRestaurantId(restaurantId);
  }, [restaurantId, profileReady, getProfileForRestaurantId]);

  const restaurantName = profile?.name?.trim() || "Restaurant";
  const restaurantSlug = profile?.slug?.trim() ?? null;

  const initialFeedRef = useRef<ReturnType<typeof initialGalleryFeedFromCache> | null>(
    null,
  );
  if (!initialFeedRef.current) {
    initialFeedRef.current = initialGalleryFeedFromCache(initialGalleryRestaurantId());
  }
  const initialFeed = initialFeedRef.current;

  const [platformFilter, setPlatformFilter] = useState<GalleryPlatformFilter>(GALLERY_FILTER_ALL);
  const [categoryFilter, setCategoryFilter] = useState<string>(GALLERY_CATEGORY_ALL);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<UnifiedGalleryItem[]>(() => initialFeed.items);
  const [highlights, setHighlights] = useState<UnifiedGalleryHighlight[]>(
    () => initialFeed.highlights,
  );
  const [categories, setCategories] = useState<GalleryCategoryOption[]>(
    () => initialFeed.categories,
  );
  const [syncMeta, setSyncMeta] = useState<GalleryFeedSyncMeta | null>(
    () => initialFeed.syncMeta,
  );
  const [loading, setLoading] = useState(() => initialFeed.loading);
  const [syncing, setSyncing] = useState(false);
  const loadGeneration = useRef(0);

  const applyCachedFeed = useCallback((cached: GalleryFeedCachePayload) => {
    setItems(cached.items);
    setHighlights(cached.highlights);
    setCategories(cached.categories);
    setSyncMeta(cached.sync);
    setLoading(false);
  }, []);

  useLayoutEffect(() => {
    if (!restaurantId) return;
    const cached = peekGalleryFeedCache(restaurantId);
    if (cached) applyCachedFeed(cached);
  }, [restaurantId, applyCachedFeed]);

  const [composeOpen, setComposeOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<UnifiedGalleryItem | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeHighlight, setActiveHighlight] = useState<UnifiedGalleryHighlight | null>(null);
  const [highlightOpen, setHighlightOpen] = useState(false);
  const [highlightComposeOpen, setHighlightComposeOpen] = useState(false);

  const { availablePlatforms } = useGalleryPlatformConnections(restaurantId);

  const load = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!restaurantId) return;
      const generation = ++loadGeneration.current;
      const cached = peekGalleryFeedCache(restaurantId);
      const silent = options?.silent ?? false;

      if (!silent) {
        if (cached) {
          applyCachedFeed(cached);
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
          if (!silent && !cached && res.status !== 403) {
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
    [restaurantId, applyCachedFeed],
  );

  useEffect(() => {
    if (!restaurantId || !ready) return;
    void load();
  }, [restaurantId, ready, load]);

  useEffect(() => {
    if (
      platformFilter !== GALLERY_FILTER_ALL &&
      !availablePlatforms.has(platformFilter)
    ) {
      setPlatformFilter(GALLERY_FILTER_ALL);
    }
  }, [platformFilter, availablePlatforms]);

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
    let polls = 0;
    const id = window.setInterval(() => {
      if (document.hidden) return;
      polls += 1;
      if (polls > GALLERY_SYNC_POLL_MAX) {
        window.clearInterval(id);
        return;
      }
      void load({ silent: true });
    }, GALLERY_SYNC_POLL_MS);
    return () => window.clearInterval(id);
  }, [syncMeta?.stale, loading, load]);

  const syncNow = useCallback(async () => {
    if (!restaurantId || syncing) return;
    setSyncing(true);
    try {
      const res = await fetch("/api/gallery/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId }),
      });
      if (!res.ok) throw new Error("sync_failed");
      await load({ silent: true });
      toast.success("Synchronisiert.");
    } catch {
      toast.error("Synchronisierung fehlgeschlagen.");
    } finally {
      setSyncing(false);
    }
  }, [restaurantId, syncing, load]);

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

  if (!restaurantId) {
    if (!ready) return <WorkspaceRestaurantResolvePlaceholder />;
    return <WorkspaceRestaurantMissingMessage />;
  }
  if (!permissionsLoading && !canRead) {
    return (
      <p className="px-4 py-8 text-sm text-muted-foreground">
        Keine Berechtigung für die Galerie.
      </p>
    );
  }

  return (
    <div className="space-y-4 px-4 pb-8 sm:px-6">
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
        feedSync={{
          syncMeta,
          syncing,
          onSyncNow: () => void syncNow(),
        }}
      >
        {loading && items.length === 0 ? (
          <div
            className="min-h-[8rem] rounded-2xl border border-border/50"
            aria-busy
            aria-label="Galerie wird geladen"
          />
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
        canShare={canCreate}
        restaurantId={restaurantId}
        restaurantName={restaurantName}
        restaurantSlug={restaurantSlug}
        onEdit={() => toast.message("Bearbeiten folgt in Kürze")}
        onDelete={() => void handleDelete()}
        onChanged={(nextPinned) => {
          if (typeof nextPinned === "boolean" && selectedItem) {
            setSelectedItem({ ...selectedItem, isPinned: nextPinned });
          }
          void load();
        }}
        onHighlightsChanged={() => void load({ silent: true })}
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
