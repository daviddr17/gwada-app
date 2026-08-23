"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
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
import { ReservationEditDrawer } from "@/components/reservations/reservation-edit-drawer";
import {
  EVENTS_FILTER_ALL,
  isEventsCacheablePlatform,
} from "@/lib/constants/events-platforms";
import {
  clampListPage,
  totalPagesFromCount,
} from "@/lib/constants/list-pagination";
import {
  EVENTS_FILTER_PRIVATE,
  parseEventsDashboardFilter,
  type EventsDashboardFilter,
} from "@/lib/events/events-dashboard-filter";
import { isPrivateEventFeedItem } from "@/lib/events/unified-event-item";
import {
  NEW_PRIVATE_EVENT_QUERY,
  PRIVATE_EVENT_QUERY,
} from "@/lib/events/private-event-href";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useEventsPlatformConnections } from "@/lib/hooks/use-events-platform-connections";
import { usePlatformFeedSyncRealtime } from "@/lib/hooks/use-platform-feed-sync-realtime";
import { useRestaurantPermissions } from "@/lib/hooks/use-restaurant-permissions";
import { hasModuleRead, hasModuleCreate } from "@/lib/permissions/module-crud-permissions";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import {
  peekEventsFeedCache,
  writeEventsFeedCache,
} from "@/lib/events/events-feed-client-cache";
import { EVENTS_FEED_PAGE_SIZE } from "@/lib/events/events-feed-pagination";
import type { EventsFeedSyncMeta } from "@/lib/events/events-feed-sync-meta";
import type { UnifiedEventItem } from "@/lib/events/unified-event-item";
import { keepAliveOwnsPathname } from "@/lib/navigation/module-home-keep-alive";
import { useKeepAliveGatedRouter } from "@/lib/navigation/use-keep-alive-gated-router";
import { RESERVATION_KIND_PRIVATE_EVENT } from "@/lib/reservations/reservation-kind";
import { modulePrimaryAddButtonFullWidthClassName } from "@/lib/ui/module-primary-add-button";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import {
  fetchReservationById,
  type ReservationListRow,
} from "@/lib/supabase/reservations-db";
import { peekCachedWorkspaceRestaurantId } from "@/lib/supabase/workspace-persistence";
import { cn } from "@/lib/utils";

const EVENTS_SYNC_POLL_MS = 5_000;
const EVENTS_SYNC_POLL_MAX = 3;

function ymdToLocalDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}

function initialEventsRestaurantId(): string | null {
  const cached = peekCachedWorkspaceRestaurantId();
  return cached && isUuidRestaurantId(cached) ? cached : null;
}

function initialEventsFeedFromCache(restaurantId: string | null): {
  items: UnifiedEventItem[];
  syncMeta: EventsFeedSyncMeta | null;
  loading: boolean;
} {
  if (!restaurantId) {
    return { items: [], syncMeta: null, loading: true };
  }
  const cached = peekEventsFeedCache(restaurantId);
  if (!cached) {
    return { items: [], syncMeta: null, loading: true };
  }
  return {
    items: cached.items,
    syncMeta: cached.sync,
    loading: false,
  };
}

export function EventsScreen({ active = true }: { active?: boolean }) {
  const activeRef = useRef(active);
  activeRef.current = active;
  const { restaurantId, ready } = useWorkspaceRestaurantUuid();
  const { has } = useRestaurantPermissions();
  const canRead = hasModuleRead(has, "events");
  const canManage = hasModuleCreate(has, "events");
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useKeepAliveGatedRouter(active);
  void canRead;

  const initialFeedRef = useRef<ReturnType<typeof initialEventsFeedFromCache> | null>(
    null,
  );
  if (!initialFeedRef.current) {
    initialFeedRef.current = initialEventsFeedFromCache(
      initialEventsRestaurantId(),
    );
  }
  const initialFeed = initialFeedRef.current;

  const [platformFilter, setPlatformFilter] = useState<EventsDashboardFilter>(
    EVENTS_FILTER_ALL,
  );
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<UnifiedEventItem[]>(() => initialFeed.items);
  const [syncMeta, setSyncMeta] = useState<EventsFeedSyncMeta | null>(
    () => initialFeed.syncMeta,
  );
  const [loading, setLoading] = useState(() => initialFeed.loading);
  const [syncing, setSyncing] = useState(false);
  const showFeedSkeleton = useDeferredSkeleton(loading && items.length === 0);
  const [composeOpen, setComposeOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<UnifiedEventItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [privateReservation, setPrivateReservation] =
    useState<ReservationListRow | null>(null);
  const [privateCreateOpen, setPrivateCreateOpen] = useState(false);
  const [privateCreateDay, setPrivateCreateDay] = useState<Date>(() => new Date());
  const { connectors, availablePlatforms } = useEventsPlatformConnections(restaurantId);
  const loadGeneration = useRef(0);
  const handledQueryRef = useRef<string>("");

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
        if (!silent && !cached && activeRef.current) {
          toast.error("Events konnten nicht geladen werden.");
        }
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

  const clearPrivateEventUrl = useCallback(() => {
    handledQueryRef.current = "";
    if (!keepAliveOwnsPathname(active, pathname, "events")) return;
    router.replace(pathname, { scroll: false });
  }, [active, pathname, router]);

  const openPrivateEvent = useCallback(
    async (reservationId: string) => {
      if (!restaurantId || !isUuidRestaurantId(reservationId)) return;
      if (!keepAliveOwnsPathname(active, pathname, "events")) return;
      const { data, error } = await fetchReservationById({
        restaurantId,
        id: reservationId,
      });
      if (error || !data) {
        if (activeRef.current) {
          toast.error("Veranstaltung konnte nicht geladen werden.");
        }
        return;
      }
      setPrivateCreateOpen(false);
      setPrivateReservation(data);
      if (keepAliveOwnsPathname(active, pathname, "events")) {
        const p = new URLSearchParams();
        p.set(PRIVATE_EVENT_QUERY, reservationId);
        router.replace(`${pathname}?${p.toString()}`, { scroll: false });
      }
    },
    [restaurantId, active, pathname, router],
  );

  const openNewPrivateEvent = useCallback(
    (day?: Date) => {
      setPrivateReservation(null);
      setPrivateCreateDay(day ?? new Date());
      setPrivateCreateOpen(true);
      if (keepAliveOwnsPathname(active, pathname, "events")) {
        const p = new URLSearchParams();
        p.set(NEW_PRIVATE_EVENT_QUERY, "1");
        router.replace(`${pathname}?${p.toString()}`, { scroll: false });
      }
    },
    [active, pathname, router],
  );

  useEffect(() => {
    if (!restaurantId || !ready) return;
    if (!keepAliveOwnsPathname(active, pathname, "events")) return;
    const filterRaw = searchParams.get("filter");
    if (filterRaw) setPlatformFilter(parseEventsDashboardFilter(filterRaw));
    const privateId = searchParams.get(PRIVATE_EVENT_QUERY);
    const newPrivate = searchParams.get(NEW_PRIVATE_EVENT_QUERY) === "1";
    const dayYmd = searchParams.get("day");
    const key = `${privateId ?? ""}|${newPrivate ? "1" : "0"}|${dayYmd ?? ""}`;
    if (handledQueryRef.current === key) return;
    handledQueryRef.current = key;
    if (privateId && isUuidRestaurantId(privateId)) {
      void openPrivateEvent(privateId);
      return;
    }
    if (newPrivate) {
      openNewPrivateEvent(dayYmd ? ymdToLocalDate(dayYmd) : undefined);
    }
  }, [
    restaurantId,
    ready,
    active,
    pathname,
    searchParams,
    openPrivateEvent,
    openNewPrivateEvent,
  ]);

  const syncNow = useCallback(async () => {
    if (!restaurantId || syncing) return;
    setSyncing(true);
    try {
      const res = await fetch("/api/events/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          platform:
            platformFilter !== EVENTS_FILTER_ALL &&
            platformFilter !== EVENTS_FILTER_PRIVATE &&
            isEventsCacheablePlatform(platformFilter)
              ? platformFilter
              : undefined,
        }),
      });
      if (!res.ok) throw new Error("sync_failed");
      await load({ silent: true });
      if (activeRef.current) toast.success("Synchronisiert.");
    } catch {
      if (activeRef.current) {
        toast.error("Synchronisierung fehlgeschlagen.");
      }
    } finally {
      setSyncing(false);
    }
  }, [restaurantId, platformFilter, syncing, load]);

  useEffect(() => {
    if (!syncMeta?.stale || loading) return;
    let polls = 0;
    const id = window.setInterval(() => {
      if (document.hidden) return;
      polls += 1;
      if (polls > EVENTS_SYNC_POLL_MAX) {
        window.clearInterval(id);
        return;
      }
      void load({ silent: true });
    }, EVENTS_SYNC_POLL_MS);
    return () => window.clearInterval(id);
  }, [syncMeta?.stale, loading, load]);

  const filteredItems = useMemo(() => {
    if (platformFilter === EVENTS_FILTER_ALL) return items;
    if (platformFilter === EVENTS_FILTER_PRIVATE) {
      return items.filter(isPrivateEventFeedItem);
    }
    return items.filter(
      (item) => !isPrivateEventFeedItem(item) && item.platform === platformFilter,
    );
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

  const privateDrawerOpen = Boolean(privateReservation) || privateCreateOpen;

  if (!ready) {
    return <WorkspaceRestaurantResolvePlaceholder />;
  }
  if (!restaurantId) {
    return <WorkspaceRestaurantMissingMessage />;
  }

  return (
    <div className="space-y-4">
      <EventsPlatformFilterChips
        value={platformFilter}
        onChange={setPlatformFilter}
        availablePlatforms={availablePlatforms}
        showPrivateChip
      />

      {canManage ? (
        <div className="space-y-2">
          <Button
            type="button"
            size="lg"
            className={modulePrimaryAddButtonFullWidthClassName}
            onClick={() => openNewPrivateEvent()}
          >
            <Plus className="size-4" />
            Neue Veranstaltung
          </Button>
          <Button
            type="button"
            size="lg"
            variant="outline"
            className={cn(
              "h-12 w-full gap-2 rounded-xl border-border/60",
            )}
            onClick={() => setComposeOpen(true)}
          >
            <Plus className="size-4" />
            Öffentliches Event
          </Button>
        </div>
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
          feedSync={{
            syncMeta,
            syncing,
            onSyncNow: () => void syncNow(),
          }}
        >
          {paginatedItems.length === 0 && !loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Noch keine Events — lege eine private Veranstaltung oder ein öffentliches Event an.
            </p>
          ) : (
            <EventsListView
              items={paginatedItems}
              onItemClick={(item) => {
                if (isPrivateEventFeedItem(item) && item.eventId) {
                  void openPrivateEvent(item.eventId);
                  return;
                }
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

      <ReservationEditDrawer
        open={privateDrawerOpen}
        onOpenChange={(open) => {
          if (!open) {
            setPrivateReservation(null);
            setPrivateCreateOpen(false);
            clearPrivateEventUrl();
          }
        }}
        reservation={privateReservation}
        createFor={
          privateCreateOpen && !privateReservation
            ? {
                restaurantId,
                day: privateCreateDay,
                initialKind: RESERVATION_KIND_PRIVATE_EVENT,
              }
            : null
        }
        lockKind={RESERVATION_KIND_PRIVATE_EVENT}
        onSaved={() => {
          setPrivateReservation(null);
          setPrivateCreateOpen(false);
          clearPrivateEventUrl();
          void load({ silent: true });
        }}
      />
    </div>
  );
}
