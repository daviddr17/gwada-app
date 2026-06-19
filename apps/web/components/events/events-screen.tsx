"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ListPaginationSurround } from "@/components/ui/list-pagination";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
import { EventsComposeDrawer } from "@/components/events/events-compose-drawer";
import { EventsDetailDrawer } from "@/components/events/events-detail-drawer";
import { EventsFeedSkeleton } from "@/components/events/events-feed-skeleton";
import { EventsListView } from "@/components/events/events-feed-views";
import { EventsPlatformFilterChips } from "@/components/events/events-platform-filter-chips";
import {
  EVENTS_FILTER_ALL,
  type EventsPlatformFilter,
} from "@/lib/constants/events-platforms";
import {
  clampListPage,
  totalPagesFromCount,
} from "@/lib/constants/list-pagination";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useEventsPlatformConnections } from "@/lib/hooks/use-events-platform-connections";
import { usePlatformFeedSyncRealtime } from "@/lib/hooks/use-platform-feed-sync-realtime";
import { useRestaurantPermissions } from "@/lib/hooks/use-restaurant-permissions";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import {
  peekEventsFeedCache,
  writeEventsFeedCache,
} from "@/lib/events/events-feed-client-cache";
import { EVENTS_FEED_PAGE_SIZE } from "@/lib/events/events-feed-pagination";
import type { EventsFeedSyncMeta } from "@/lib/events/events-feed-sync-meta";
import type { UnifiedEventItem } from "@/lib/events/unified-event-item";
import { modulePrimaryAddButtonFullWidthClassName } from "@/lib/ui/module-primary-add-button";

export function EventsScreen() {
  const { restaurantId, ready } = useWorkspaceRestaurantUuid();
  const { has } = useRestaurantPermissions();
  const canManage = has("events.manage");

  const [platformFilter, setPlatformFilter] = useState<EventsPlatformFilter>(EVENTS_FILTER_ALL);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<UnifiedEventItem[]>([]);
  const [syncMeta, setSyncMeta] = useState<EventsFeedSyncMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const showFeedSkeleton = useDeferredSkeleton(loading && items.length === 0);
  const [composeOpen, setComposeOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<UnifiedEventItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const { connectors, availablePlatforms } = useEventsPlatformConnections(restaurantId);
  const loadGeneration = useRef(0);

  const applyCachedFeed = useCallback((cached: ReturnType<typeof peekEventsFeedCache>) => {
    if (!cached) return;
    setItems(cached.items);
    setSyncMeta(cached.sync);
    setLoading(false);
  }, []);

  useLayoutEffect(() => {
    if (!restaurantId) return;
    applyCachedFeed(peekEventsFeedCache(restaurantId));
  }, [restaurantId, applyCachedFeed]);

  const load = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!restaurantId) return;
      const generation = ++loadGeneration.current;
      const cached = peekEventsFeedCache(restaurantId);
      const silent = options?.silent ?? false;

      if (!silent) {
        if (cached) applyCachedFeed(cached);
        else setLoading(true);
      }

      try {
        const res = await fetch(`/api/events?${new URLSearchParams({ restaurantId })}`);
        const data = (await res.json()) as {
          items?: UnifiedEventItem[];
          sync?: EventsFeedSyncMeta;
          error?: string;
        };
        if (generation !== loadGeneration.current) return;
        if (!res.ok) throw new Error(data.error ?? "load_failed");
        const nextItems = data.items ?? [];
        const nextSync = data.sync ?? null;
        setItems(nextItems);
        setSyncMeta(nextSync);
        writeEventsFeedCache(restaurantId, { items: nextItems, sync: nextSync });
      } catch {
        if (!silent && !cached) toast.error("Events konnten nicht geladen werden.");
      } finally {
        if (!silent && generation === loadGeneration.current) setLoading(false);
      }
    },
    [restaurantId, applyCachedFeed],
  );

  useEffect(() => {
    if (!restaurantId || !ready) return;
    void load();
  }, [restaurantId, ready, load]);

  usePlatformFeedSyncRealtime("restaurant_events_platform_sync", () => {
    void load({ silent: true });
  }, { enabled: Boolean(restaurantId && ready) });

  const syncNow = useCallback(async () => {
    if (!restaurantId || syncing) return;
    setSyncing(true);
    try {
      const res = await fetch("/api/events/sync", {
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

  const filteredItems = useMemo(() => {
    if (platformFilter === EVENTS_FILTER_ALL) return items;
    return items.filter((item) => item.platform === platformFilter);
  }, [items, platformFilter]);

  useEffect(() => {
    setPage(1);
  }, [platformFilter]);

  const totalCount = filteredItems.length;
  const totalPages = totalPagesFromCount(totalCount, EVENTS_FEED_PAGE_SIZE);
  const currentPage = clampListPage(page, totalPages);
  const paginatedItems = useMemo(() => {
    const from = (currentPage - 1) * EVENTS_FEED_PAGE_SIZE;
    return filteredItems.slice(from, from + EVENTS_FEED_PAGE_SIZE);
  }, [filteredItems, currentPage]);

  if (!ready) {
    return <WorkspaceRestaurantResolvePlaceholder />;
  }
  if (!restaurantId) {
    return <WorkspaceRestaurantMissingMessage />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <EventsPlatformFilterChips
          value={platformFilter}
          onChange={setPlatformFilter}
          availablePlatforms={availablePlatforms}
        />
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="rounded-full border-border/60"
          disabled={syncing}
          onClick={() => void syncNow()}
          aria-label="Jetzt synchronisieren"
        >
          <RefreshCw className={syncing ? "size-4 animate-spin" : "size-4"} />
        </Button>
      </div>

      {syncMeta?.stale ? (
        <p className="text-xs text-muted-foreground">
          Externe Events werden im Hintergrund aktualisiert …
        </p>
      ) : null}

      {canManage ? (
        <Button
          type="button"
          size="lg"
          className={modulePrimaryAddButtonFullWidthClassName}
          onClick={() => setComposeOpen(true)}
        >
          <Plus className="size-4" />
          Neues Event
        </Button>
      ) : null}

      {showFeedSkeleton ? (
        <EventsFeedSkeleton />
      ) : (
        <ListPaginationSurround
          classNameAbove="px-0 pt-0"
          classNameBelow="px-0 pb-0"
          page={currentPage}
          totalPages={totalPages}
          shown={paginatedItems.length}
          totalCount={totalCount}
          itemLabel="Events"
          canPrevious={currentPage > 1}
          canNext={currentPage < totalPages}
          onPrevious={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
        >
          {paginatedItems.length === 0 && !loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Noch keine Events — verbinde Facebook oder Google, oder lege ein Event an.
            </p>
          ) : (
            <EventsListView
              items={paginatedItems}
              onItemClick={(item) => {
                setDetailItem(item);
                setDetailOpen(true);
              }}
            />
          )}
        </ListPaginationSurround>
      )}

      <EventsComposeDrawer
        open={composeOpen}
        onOpenChange={setComposeOpen}
        restaurantId={restaurantId}
        connectors={connectors}
        onSaved={() => void load({ silent: true })}
      />

      <EventsDetailDrawer
        open={detailOpen}
        onOpenChange={setDetailOpen}
        item={detailItem}
        restaurantId={restaurantId}
        canManage={canManage}
        onChanged={(nextPinned) => {
          if (typeof nextPinned === "boolean" && detailItem) {
            setDetailItem({ ...detailItem, isPinned: nextPinned });
          }
          void load({ silent: true });
        }}
      />
    </div>
  );
}
