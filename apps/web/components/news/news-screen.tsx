"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LayoutGrid, List, Plus, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListPaginationSurround } from "@/components/ui/list-pagination";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
import { NewsComposeDrawer } from "@/components/news/news-compose-drawer";
import { NewsDetailDrawer } from "@/components/news/news-detail-drawer";
import { NewsFeedSkeleton } from "@/components/news/news-feed-skeleton";
import { NewsGridView, NewsListView } from "@/components/news/news-feed-views";
import { NewsPlatformFilterChips } from "@/components/news/news-platform-filter-chips";
import {
  moduleSearchFieldWrapClassName,
  moduleSearchFilterRowClassName,
  moduleSearchInputClassName,
} from "@/lib/ui/module-search-filter-toolbar";
import { modulePrimaryAddButtonFullWidthClassName } from "@/lib/ui/module-primary-add-button";
import { ListRangeCount } from "@/lib/ui/list-range-count";
import {
  NEWS_FILTER_ALL,
  type NewsPlatformFilter,
  type NewsViewMode,
} from "@/lib/constants/news-platforms";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useNewsPlatformConnections } from "@/lib/hooks/use-news-platform-connections";
import { useRestaurantPermissions } from "@/lib/hooks/use-restaurant-permissions";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { sortNewsItemsByDate } from "@/lib/news/format-news-display-date";
import {
  peekNewsFeedCache,
  writeNewsFeedCache,
} from "@/lib/news/news-feed-client-cache";
import type { NewsFeedSyncMeta } from "@/lib/news/news-feed-sync-meta";
import { NEWS_PLATFORM_LABELS } from "@/lib/constants/news-platforms";
import {
  isNewsCacheablePlatform,
  type NewsCacheablePlatform,
} from "@/lib/news/news-cache-constants";
import type { UnifiedNewsItem } from "@/lib/news/unified-news-item";
import { NEWS_FEED_PAGE_SIZE } from "@/lib/news/news-feed-pagination";
import {
  patchNewsScreenQueryUrl,
  readNewsScreenQueryFromSearch,
} from "@/lib/news/news-screen-query";
import {
  clampListPage,
  totalPagesFromCount,
} from "@/lib/constants/list-pagination";

const NEWS_SYNC_POLL_MS = 5_000;
const NEWS_SYNC_POLL_MAX = 12;

export function NewsScreen() {
  const { restaurantId, ready } = useWorkspaceRestaurantUuid();
  const { has } = useRestaurantPermissions();
  const canManage = has("news.manage");
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [platformFilter, setPlatformFilterState] = useState<NewsPlatformFilter>(
    () => readNewsScreenQueryFromSearch(searchParams.toString()).platformFilter,
  );
  const [viewMode, setViewModeState] = useState<NewsViewMode>(
    () => readNewsScreenQueryFromSearch(searchParams.toString()).viewMode,
  );

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<UnifiedNewsItem[]>([]);
  const [syncMeta, setSyncMeta] = useState<NewsFeedSyncMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const showFeedSkeleton = useDeferredSkeleton(loading && items.length === 0);
  const [composeOpen, setComposeOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<UnifiedNewsItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const { connectors, availablePlatforms } = useNewsPlatformConnections(restaurantId);
  const loadGeneration = useRef(0);

  const applyFeedResponse = useCallback(
    (
      data: { items?: UnifiedNewsItem[]; sync?: NewsFeedSyncMeta },
      cacheRestaurantId: string,
    ) => {
      const nextItems = data.items ?? [];
      const nextSync = data.sync ?? null;
      setItems(nextItems);
      setSyncMeta(nextSync);
      writeNewsFeedCache(cacheRestaurantId, NEWS_FILTER_ALL, nextItems, nextSync);
    },
    [],
  );

  const load = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!restaurantId) return;
      const generation = ++loadGeneration.current;
      const cached = peekNewsFeedCache(restaurantId, NEWS_FILTER_ALL);
      const silent = options?.silent ?? false;

      if (!silent) {
        if (cached) {
          setItems(cached.items);
          setSyncMeta(cached.sync);
          setLoading(false);
        } else {
          setLoading(true);
          setItems([]);
        }
      }

      try {
        const qs = new URLSearchParams({ restaurantId });
        const res = await fetch(`/api/news?${qs}`);
        const data = (await res.json()) as {
          items?: UnifiedNewsItem[];
          sync?: NewsFeedSyncMeta;
          error?: string;
        };
        if (generation !== loadGeneration.current) return;
        if (!res.ok) throw new Error(data.error ?? "load_failed");
        applyFeedResponse(data, restaurantId);
      } catch {
        if (generation !== loadGeneration.current) return;
        if (!silent && !cached) setItems([]);
        if (!silent && !cached) {
          toast.error("News konnten nicht geladen werden.");
        }
      } finally {
        if (!silent && generation === loadGeneration.current) {
          setLoading(false);
        }
      }
    },
    [restaurantId, applyFeedResponse],
  );

  const refreshFeed = useCallback(() => {
    void load({ silent: true });
  }, [load]);

  const syncNow = useCallback(async () => {
    if (!restaurantId || syncing) return;
    setSyncing(true);
    try {
      const res = await fetch("/api/news/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          platform: platformFilter !== NEWS_FILTER_ALL ? platformFilter : undefined,
        }),
      });
      const data = (await res.json()) as {
        items?: UnifiedNewsItem[];
        sync?: NewsFeedSyncMeta;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "sync_failed");
      await load({ silent: true });
    } catch {
      toast.error("Synchronisierung fehlgeschlagen.");
    } finally {
      setSyncing(false);
    }
  }, [restaurantId, platformFilter, syncing, load]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!syncMeta?.stale || loading) return;
    let polls = 0;
    const id = window.setInterval(() => {
      if (document.hidden) return;
      polls += 1;
      if (polls > NEWS_SYNC_POLL_MAX) {
        window.clearInterval(id);
        return;
      }
      void load({ silent: true });
    }, NEWS_SYNC_POLL_MS);
    return () => window.clearInterval(id);
  }, [syncMeta?.stale, loading, load]);

  useEffect(() => {
    const onPopState = () => {
      const next = readNewsScreenQueryFromSearch(window.location.search);
      setPlatformFilterState(next.platformFilter);
      setViewModeState(next.viewMode);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (searchParams.get("new") === "1" && canManage) {
      setComposeOpen(true);
      const next = new URLSearchParams(searchParams.toString());
      next.delete("new");
      router.replace(next.toString() ? `${pathname}?${next}` : pathname, {
        scroll: false,
      });
    }
  }, [searchParams, canManage, router]);

  const sortedItems = useMemo(() => sortNewsItemsByDate(items), [items]);

  useEffect(() => {
    setPage(1);
  }, [platformFilter, search]);

  const filtered = useMemo(() => {
    let list =
      platformFilter === NEWS_FILTER_ALL
        ? sortedItems
        : sortedItems.filter((i) => i.platform === platformFilter);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (i) =>
          i.body.toLowerCase().includes(q) ||
          (i.title?.toLowerCase().includes(q) ?? false),
      );
    }
    return list;
  }, [sortedItems, platformFilter, search]);

  const totalCount = filtered.length;
  const totalPages = totalPagesFromCount(totalCount, NEWS_FEED_PAGE_SIZE);
  const currentPage = clampListPage(page, totalPages);

  const paginatedItems = useMemo(() => {
    const from = (currentPage - 1) * NEWS_FEED_PAGE_SIZE;
    return filtered.slice(from, from + NEWS_FEED_PAGE_SIZE);
  }, [filtered, currentPage]);

  const setPlatformFilter = useCallback(
    (next: NewsPlatformFilter) => {
      startTransition(() => {
        setPlatformFilterState(next);
      });
      patchNewsScreenQueryUrl(pathname, (params) => {
        if (next === NEWS_FILTER_ALL) params.delete("platform");
        else params.set("platform", next);
      });
    },
    [pathname],
  );

  const openDetail = useCallback((item: UnifiedNewsItem) => {
    setDetailItem(item);
    setDetailOpen(true);
  }, []);

  const setViewMode = useCallback(
    (next: NewsViewMode) => {
      startTransition(() => {
        setViewModeState(next);
      });
      patchNewsScreenQueryUrl(pathname, (params) => {
        if (next === "grid") params.delete("view");
        else params.set("view", next);
      });
    },
    [pathname],
  );

  if (!ready) return <WorkspaceRestaurantResolvePlaceholder />;
  if (!restaurantId) return <WorkspaceRestaurantMissingMessage />;

  return (
    <div className="space-y-4">
      <NewsPlatformFilterChips
        value={platformFilter}
        onChange={setPlatformFilter}
        availablePlatforms={availablePlatforms}
      />

      {syncMeta?.stale || syncMeta?.lastSyncedAt ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {syncMeta.lastSyncedAt ? (
              <>
                Externe Kanäle zuletzt aktualisiert:{" "}
                {new Date(syncMeta.lastSyncedAt).toLocaleString("de-DE", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </>
            ) : (
              "Externe Kanäle werden synchronisiert …"
            )}
            {syncMeta.stale ? " · Aktualisierung läuft …" : null}
          </p>
          {syncMeta.stale || syncing ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full border-border/60"
              disabled={syncing}
              onClick={() => void syncNow()}
            >
              <RefreshCw className={syncing ? "size-4 animate-spin" : "size-4"} />
              Jetzt synchronisieren
            </Button>
          ) : null}
        </div>
      ) : null}

      {syncMeta?.platformErrors &&
      Object.keys(syncMeta.platformErrors).length > 0 ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
          {Object.entries(syncMeta.platformErrors).map(([platform, message]) => (
            <p key={platform}>
              {NEWS_PLATFORM_LABELS[platform as NewsCacheablePlatform]}: {message}
            </p>
          ))}
        </div>
      ) : null}

      <div className={moduleSearchFilterRowClassName}>
        <div className={moduleSearchFieldWrapClassName}>
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="News durchsuchen …"
            className={moduleSearchInputClassName}
            aria-label="News durchsuchen"
          />
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-full border border-border/50 bg-muted/35 p-1">
          <Button
            type="button"
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="icon-sm"
            className="rounded-full"
            aria-pressed={viewMode === "grid"}
            onClick={() => setViewMode("grid")}
            aria-label="Raster"
          >
            <LayoutGrid className="size-4" />
          </Button>
          <Button
            type="button"
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="icon-sm"
            className="rounded-full"
            aria-pressed={viewMode === "list"}
            onClick={() => setViewMode("list")}
            aria-label="Liste"
          >
            <List className="size-4" />
          </Button>
        </div>
      </div>

      {!showFeedSkeleton ? (
        <ListRangeCount
          shown={paginatedItems.length}
          total={totalCount}
          itemLabel="Beiträge"
        />
      ) : null}

      {canManage ? (
        <Button
          type="button"
          size="lg"
          className={modulePrimaryAddButtonFullWidthClassName}
          onClick={() => setComposeOpen(true)}
        >
          <Plus className="size-4" />
          Neue News
        </Button>
      ) : null}

      {showFeedSkeleton ? (
        <NewsFeedSkeleton viewMode={viewMode} />
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {platformFilter !== NEWS_FILTER_ALL &&
          isNewsCacheablePlatform(platformFilter) &&
          syncMeta?.platformItemCounts?.[platformFilter] === 0 &&
          !syncMeta?.platformErrors?.[platformFilter]
            ? `${NEWS_PLATFORM_LABELS[platformFilter]}: Sync erfolgreich, aber keine Beiträge im Konto — unter Einstellungen → Integrationen prüfen oder „Jetzt synchronisieren“.`
            : "Noch keine News in dieser Ansicht."}
        </p>
      ) : (
        <>
          <ListPaginationSurround
            page={currentPage}
            totalPages={totalPages}
            totalCount={totalCount}
            itemLabel="Beiträge"
            canPrevious={currentPage > 1}
            canNext={currentPage < totalPages}
            onPrevious={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
          {viewMode === "list" ? (
            <NewsListView items={paginatedItems} onItemClick={openDetail} />
          ) : (
            <NewsGridView items={paginatedItems} onItemClick={openDetail} />
          )}
          </ListPaginationSurround>
        </>
      )}

      <NewsDetailDrawer
        open={detailOpen}
        onOpenChange={setDetailOpen}
        item={detailItem}
        restaurantId={restaurantId}
        canManage={canManage}
        connectors={connectors}
        onChanged={refreshFeed}
      />

      {canManage && restaurantId ? (
        <NewsComposeDrawer
          open={composeOpen}
          onOpenChange={setComposeOpen}
          restaurantId={restaurantId}
          connectors={connectors}
          onSaved={refreshFeed}
        />
      ) : null}
    </div>
  );
}
