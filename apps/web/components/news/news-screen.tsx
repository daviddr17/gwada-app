"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LayoutGrid, List, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
import { NewsComposeDrawer } from "@/components/news/news-compose-drawer";
import { NewsDetailDrawer } from "@/components/news/news-detail-drawer";
import { NewsMasonryGrid, NewsListView } from "@/components/news/news-feed-views";
import { NewsPlatformFilterChips } from "@/components/news/news-platform-filter-chips";
import {
  moduleSearchFieldWrapClassName,
  moduleSearchFilterRowClassName,
  moduleSearchInputClassName,
} from "@/lib/ui/module-search-filter-toolbar";
import { modulePrimaryAddButtonFullWidthClassName } from "@/lib/ui/module-primary-add-button";
import {
  NEWS_FILTER_ALL,
  parseNewsPlatformFilter,
  parseNewsViewMode,
  type NewsPlatformFilter,
  type NewsViewMode,
} from "@/lib/constants/news-platforms";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useNewsPlatformConnections } from "@/lib/hooks/use-news-platform-connections";
import { useRestaurantPermissions } from "@/lib/hooks/use-restaurant-permissions";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import type { UnifiedNewsItem } from "@/lib/news/unified-news-item";

export function NewsScreen() {
  const { restaurantId, ready } = useWorkspaceRestaurantUuid();
  const { has } = useRestaurantPermissions();
  const canManage = has("news.manage");
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const platformFilter = parseNewsPlatformFilter(searchParams.get("platform"));
  const viewMode = parseNewsViewMode(searchParams.get("view"));

  const [search, setSearch] = useState("");
  const [items, setItems] = useState<UnifiedNewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDeferredSkeleton(loading);
  const [composeOpen, setComposeOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<UnifiedNewsItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const { connectors, availablePlatforms } = useNewsPlatformConnections(restaurantId);

  const load = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams({ restaurantId });
      if (platformFilter !== NEWS_FILTER_ALL) {
        qs.set("platform", platformFilter);
      }
      const res = await fetch(`/api/news?${qs}`);
      const data = (await res.json()) as { items?: UnifiedNewsItem[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "load_failed");
      setItems(data.items ?? []);
    } catch {
      toast.error("News konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, [restaurantId, platformFilter]);

  useEffect(() => {
    void load();
  }, [load]);

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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.body.toLowerCase().includes(q) ||
        (i.title?.toLowerCase().includes(q) ?? false),
    );
  }, [items, search]);

  const setPlatformFilter = (next: NewsPlatformFilter) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === NEWS_FILTER_ALL) params.delete("platform");
    else params.set("platform", next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const openDetail = useCallback((item: UnifiedNewsItem) => {
    setDetailItem(item);
    setDetailOpen(true);
  }, []);

  const setViewMode = (next: NewsViewMode) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "grid") params.delete("view");
    else params.set("view", next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  if (!ready) return <WorkspaceRestaurantResolvePlaceholder />;
  if (!restaurantId) return <WorkspaceRestaurantMissingMessage />;

  return (
    <div className="space-y-4">
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

      <NewsPlatformFilterChips
        value={platformFilter}
        onChange={setPlatformFilter}
        availablePlatforms={availablePlatforms}
      />

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

      {loading && showSkeleton ? (
        <div className="min-h-40 rounded-xl border border-border/50 bg-muted/20" aria-busy />
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">Noch keine News in dieser Ansicht.</p>
      ) : viewMode === "list" ? (
        <NewsListView items={filtered} onItemClick={openDetail} />
      ) : (
        <NewsMasonryGrid items={filtered} onItemClick={openDetail} />
      )}

      <NewsDetailDrawer
        open={detailOpen}
        onOpenChange={setDetailOpen}
        item={detailItem}
        restaurantId={restaurantId}
        canManage={canManage}
        connectors={connectors}
        onChanged={() => void load()}
      />

      {canManage && restaurantId ? (
        <NewsComposeDrawer
          open={composeOpen}
          onOpenChange={setComposeOpen}
          restaurantId={restaurantId}
          connectors={connectors}
          onSaved={() => void load()}
        />
      ) : null}
    </div>
  );
}
