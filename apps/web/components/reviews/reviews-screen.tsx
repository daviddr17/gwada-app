"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Filter, LayoutGrid, Link2, List, ScrollText, Search } from "lucide-react";
import {
  countReviewsDrawerActiveFilters,
  ReviewsFilterDrawer,
} from "@/components/reviews/reviews-filter-drawer";
import { ReviewInboxFilterChips } from "@/components/reviews/review-inbox-filter-chips";
import {
  ReviewsGridView,
  ReviewsListView,
} from "@/components/reviews/reviews-feed-views";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
import { ContactEditDrawer } from "@/components/contacts/contact-edit-drawer";
import { ReservationEditDrawer } from "@/components/reservations/reservation-edit-drawer";
import { GwadaReviewProtocolDrawer } from "@/components/reviews/gwada-review-protocol-drawer";
import { ReviewInvitationSheet } from "@/components/reviews/review-invitation-sheet";
import { ReviewSummaryCard } from "@/components/reviews/review-summary-card";
import { ReviewsScreenSkeleton } from "@/components/reviews/reviews-screen-skeleton";
import { ReviewsPaginationSurround } from "@/components/reviews/reviews-pagination";
import { settingsAccentSaveButtonClassName } from "@/components/settings/settings-sticky-save-bar";
import {
  moduleSearchFieldWrapClassName,
  moduleSearchFilterActiveBadgeClassName,
  moduleSearchFilterButtonClassName,
  moduleSearchFilterButtonWrapClassName,
  moduleSearchFilterRowClassName,
  moduleSearchInputClassName,
} from "@/lib/ui/module-search-filter-toolbar";
import {
  parseReviewPlatformFilter,
  REVIEW_FILTER_ALL,
  REVIEW_PLATFORM_LABELS,
  type ReviewPlatform,
  type ReviewPlatformFilter,
} from "@/lib/constants/review-platforms";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { usePlatformFeedSyncRealtime } from "@/lib/hooks/use-platform-feed-sync-realtime";
import { useReviewPlatformConnections } from "@/lib/hooks/use-review-platform-connections";
import { useRestaurantPermissions } from "@/lib/hooks/use-restaurant-permissions";
import { hasModuleRead, hasModuleCreate } from "@/lib/permissions/module-crud-permissions";
import { ModuleAccessDenied } from "@/lib/permissions/module-access-denied";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import type { UnifiedReview } from "@/lib/reviews/unified-review";
import { setFeedItemPin } from "@/lib/feed-pin/feed-pin-client";
import {
  patchReviewsScreenQueryUrl,
  readReviewsScreenQueryFromSearch,
  type ReviewViewMode,
} from "@/lib/reviews/reviews-screen-query";
import {
  createEmptyReviewsFeedClientCache,
  markReviewsReadInFeedCache,
  patchReviewInFeedCache,
  type ReviewsFeedClientCache,
} from "@/lib/reviews/reviews-feed-client-cache";
import { isReviewsCacheablePlatform } from "@/lib/reviews/reviews-cache-constants";
import type { ReviewsFeedSyncMeta } from "@/lib/reviews/reviews-feed-sync-meta";
import {
  fetchReservationById,
  type ReservationListRow,
} from "@/lib/supabase/reservations-db";
import {
  filterReviews,
  hasActiveReviewFilters,
  sortReviews,
  type ReviewCommentFilter,
  type ReviewRatingFilter,
  type ReviewReplyFilter,
  type ReviewSortKey,
} from "@/lib/reviews/filter-sort-reviews";
import {
  markAllReviewsReadClient,
  markReviewReadBatchClient,
  markReviewUnreadClient,
} from "@/lib/reviews/fetch-review-read-client";
import type { ReviewReadFilter } from "@/lib/reviews/review-read-state";
import { reviewReadLookupKey } from "@/lib/reviews/review-read-state";
import type { GoogleReviewsPaginationMeta } from "@/lib/reviews/google-reviews-pagination";
import { googleReviewsTotalPages } from "@/lib/reviews/google-reviews-pagination";
import type { MergedReviewsPaginationMeta } from "@/lib/reviews/reviews-list-pagination";
import type { ReviewListPaginationMeta } from "@/lib/reviews/reviews-list-pagination";
import { reviewListTotalPages } from "@/lib/reviews/reviews-list-pagination";
import {
  averageRating,
  medianRating,
  ratingDistribution,
} from "@/lib/reviews/review-stats";
import { useRestaurantProfile } from "@/lib/contexts/restaurant-profile-context";
import {
  COUNTRIES_REFERENCE_FALLBACK,
  resolveCountryIso2FromLabel,
} from "@/lib/constants/countries";
import { modulePrimaryAddButtonFullWidthClassName } from "@/lib/ui/module-primary-add-button";
import {
  PlatformFeedListMetaRow,
  platformFeedSyncMetaVisible,
} from "@/components/platform-feed/platform-feed-sync-status-bar";

const REVIEWS_SYNC_POLL_MS = 5_000;
const REVIEWS_SYNC_POLL_MAX = 3;

type ReviewsApiResponse = {
  reviews: UnifiedReview[];
  summary: {
    count: number;
    average: number | null;
    median: number | null;
    distribution: Record<1 | 2 | 3 | 4 | 5, number>;
    scope?: "google_location" | "page";
  };
  googlePagination?: GoogleReviewsPaginationMeta;
  mergedPagination?: MergedReviewsPaginationMeta;
  facebookPagination?: ReviewListPaginationMeta;
  platformTotals?: Partial<Record<ReviewPlatform, number>>;
  loadErrors?: Partial<Record<ReviewPlatform, string>>;
  loadError?: string | null;
  sync?: ReviewsFeedSyncMeta;
};

type GoogleLocationSummary = {
  count: number;
  average: number | null;
  median: null;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
  scope: "google_location";
};

function withNextPageToken(
  currentPage: number,
  nextToken: string | null | undefined,
  prev: Record<number, string>,
): Record<number, string> {
  if (!nextToken) return prev;
  return { ...prev, [currentPage + 1]: nextToken };
}

export function ReviewsScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const platformParam = searchParams.get("platform");
  const { restaurantId, ready } = useWorkspaceRestaurantUuid();
  const { has, loading: permissionsLoading } = useRestaurantPermissions();
  const canRead = hasModuleRead(has, "reviews");
  const {
    loading: connectionsLoading,
    googleVisible,
    facebookVisible,
  } = useReviewPlatformConnections(restaurantId);
  const [platformFilter, setPlatformFilter] = useState<ReviewPlatformFilter>(() =>
    parseReviewPlatformFilter(platformParam),
  );
  const [feedCache, setFeedCache] = useState<ReviewsFeedClientCache>(() =>
    createEmptyReviewsFeedClientCache(),
  );
  const [feedPrefetchLoading, setFeedPrefetchLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [paginationBusy, setPaginationBusy] = useState(false);
  const [googlePage, setGooglePage] = useState(1);
  const [allPage, setAllPage] = useState(1);
  const [facebookPage, setFacebookPage] = useState(1);
  const [googleLocationSummary, setGoogleLocationSummary] =
    useState<GoogleLocationSummary | null>(null);
  const [googleStatsError, setGoogleStatsError] = useState<string | null>(null);
  const [replyTarget, setReplyTarget] = useState<UnifiedReview | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyBusy, setReplyBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [ratingFilter, setRatingFilter] = useState<ReviewRatingFilter>("all");
  const [commentFilter, setCommentFilter] =
    useState<ReviewCommentFilter>("all");
  const [replyFilter, setReplyFilter] = useState<ReviewReplyFilter>("all");
  const [readFilter, setReadFilter] = useState<ReviewReadFilter>("all");
  const [readLocal, setReadLocal] = useState<Record<string, boolean>>({});
  const [sortKey, setSortKey] = useState<ReviewSortKey>("created_desc");
  const [filterOpen, setFilterOpen] = useState(false);
  const [inviteSheetOpen, setInviteSheetOpen] = useState(false);
  const [viewMode, setViewModeState] = useState<ReviewViewMode>(() =>
    readReviewsScreenQueryFromSearch(searchParams.toString()).viewMode,
  );
  const [reservationDrawerOpen, setReservationDrawerOpen] = useState(false);
  const [reservationDrawerRow, setReservationDrawerRow] =
    useState<ReservationListRow | null>(null);
  const [visibilityBusyKey, setVisibilityBusyKey] = useState<string | null>(null);
  const [pinBusyKey, setPinBusyKey] = useState<string | null>(null);

  useEffect(() => {
    setViewModeState(readReviewsScreenQueryFromSearch(searchParams.toString()).viewMode);
  }, [searchParams]);

  const setViewMode = useCallback(
    (next: ReviewViewMode) => {
      setViewModeState(next);
      patchReviewsScreenQueryUrl(pathname, (params) => {
        if (next === "grid") {
          params.delete("view");
        } else {
          params.set("view", next);
        }
      });
    },
    [pathname],
  );

  useEffect(() => {
    if (searchParams.get("new") !== "invite") return;
    setPlatformFilter("gwada");
    setInviteSheetOpen(true);
    const p = new URLSearchParams(searchParams.toString());
    p.delete("new");
    p.set("platform", "gwada");
    const q = p.toString();
    router.replace(
      q ? `/dashboard/bewertungen/uebersicht?${q}` : "/dashboard/bewertungen/uebersicht",
      { scroll: false },
    );
  }, [searchParams, router]);

  const [protocolReview, setProtocolReview] = useState<UnifiedReview | null>(null);
  const [overviewProtocolOpen, setOverviewProtocolOpen] = useState(false);
  const [contactDrawerOpen, setContactDrawerOpen] = useState(false);
  const [contactDrawerId, setContactDrawerId] = useState<string | null>(null);
  const { getProfileForRestaurantId, isReady: profileReady } =
    useRestaurantProfile();
  const isGooglePaginated = platformFilter === "google";
  const isAllPaginated = platformFilter === REVIEW_FILTER_ALL;
  const isFacebookPaginated = platformFilter === "facebook";
  const googlePagination = feedCache.googlePagination;
  const mergedPagination = feedCache.allPagination;
  const facebookPagination = feedCache.facebookPagination;
  const mergedLoadErrors = feedCache.loadErrors;
  const mergedPlatformTotals = feedCache.platformTotals;
  const showSkeleton = useDeferredSkeleton(feedPrefetchLoading);
  const readAllStartedRef = useRef<string | null>(null);

  const markLoadedReviewsRead = useCallback(
    (reviews: UnifiedReview[]) => {
      if (!restaurantId || reviews.length === 0) return;
      setReadLocal((prev) => {
        const next = { ...prev };
        for (const review of reviews) {
          next[reviewReadLookupKey(review.platform, review.id)] = false;
        }
        return next;
      });
      void markReviewReadBatchClient({
        restaurantId,
        items: reviews.map((review) => ({
          platform: review.platform,
          reviewId: review.id,
        })),
      });
    },
    [restaurantId],
  );

  const restaurantProfile = useMemo(() => {
    if (!restaurantId || !profileReady) return null;
    return getProfileForRestaurantId(restaurantId);
  }, [restaurantId, profileReady, getProfileForRestaurantId]);

  const restaurantDisplayName = restaurantProfile?.name?.trim() ?? "Restaurant";
  const defaultCountryIso2 = useMemo(
    () =>
      resolveCountryIso2FromLabel(
        restaurantProfile?.country ?? "",
        COUNTRIES_REFERENCE_FALLBACK,
      ),
    [restaurantProfile?.country],
  );

  const showReplyFilter =
    platformFilter === REVIEW_FILTER_ALL ||
    platformFilter === "google" ||
    platformFilter === "facebook";

  const isPlatformAvailable = useCallback(
    (p: ReviewPlatform): boolean => {
      if (p === "gwada") return true;
      if (p === "google") return googleVisible;
      if (p === "facebook") return facebookVisible;
      return false;
    },
    [googleVisible, facebookVisible],
  );

  const platformViewReady =
    platformFilter === REVIEW_FILTER_ALL ||
    isPlatformAvailable(platformFilter);

  const reviewProtocolParam = searchParams.get("reviewProtocol")?.trim() ?? "";

  const allReviews = useMemo(() => {
    if (platformFilter === "google") {
      return feedCache.googlePages[googlePage] ?? [];
    }
    if (platformFilter === "facebook") {
      return feedCache.facebookPages[facebookPage] ?? [];
    }
    if (platformFilter === REVIEW_FILTER_ALL) {
      return feedCache.allPages[allPage] ?? [];
    }
    return feedCache.gwada;
  }, [platformFilter, feedCache, googlePage, facebookPage, allPage]);

  useEffect(() => {
    if (!reviewProtocolParam || platformFilter !== "gwada" || !ready) return;
    const match = allReviews.find(
      (r) => r.platform === "gwada" && r.id === reviewProtocolParam,
    );
    if (match) {
      setProtocolReview(match);
    }
  }, [reviewProtocolParam, platformFilter, ready, allReviews]);

  useEffect(() => {
    if (connectionsLoading || !ready || !restaurantId) return;

    const requested = parseReviewPlatformFilter(platformParam);
    const resolved =
      requested !== REVIEW_FILTER_ALL && !isPlatformAvailable(requested)
        ? REVIEW_FILTER_ALL
        : requested;

    setPlatformFilter((prev) => (prev === resolved ? prev : resolved));

    const paramMatches =
      resolved === REVIEW_FILTER_ALL
        ? !platformParam || platformParam === REVIEW_FILTER_ALL
        : platformParam === resolved;

    if (!paramMatches) {
      const params = new URLSearchParams(searchParams.toString());
      if (resolved === REVIEW_FILTER_ALL) {
        params.delete("platform");
      } else {
        params.set("platform", resolved);
      }
      const q = params.toString();
      router.replace(
        q
          ? `/dashboard/bewertungen/uebersicht?${q}`
          : "/dashboard/bewertungen/uebersicht",
      );
    }
  }, [
    connectionsLoading,
    ready,
    restaurantId,
    platformParam,
    isPlatformAvailable,
    router,
    searchParams,
  ]);

  const selectPlatformFilter = (filter: ReviewPlatformFilter) => {
    if (filter !== REVIEW_FILTER_ALL && !isPlatformAvailable(filter)) return;
    setPlatformFilter(filter);
    const params = new URLSearchParams(searchParams.toString());
    if (filter === REVIEW_FILTER_ALL) {
      params.delete("platform");
    } else {
      params.set("platform", filter);
    }
    const q = params.toString();
    router.replace(
      q
        ? `/dashboard/bewertungen/uebersicht?${q}`
        : "/dashboard/bewertungen/uebersicht",
    );
  };

  const fetchReviewsJson = useCallback(
    async (params: URLSearchParams) => {
      const res = await fetch(`/api/reviews?${params}`);
      const json = (await res.json()) as ReviewsApiResponse & { error?: string };
      return { res, json };
    },
    [],
  );

  const prefetchFeed = useCallback(async (options?: { silent?: boolean }) => {
    if (!restaurantId) {
      if (!options?.silent) setFeedPrefetchLoading(false);
      return;
    }
    if (!options?.silent) {
      setFeedPrefetchLoading(true);
      setFeedCache(createEmptyReviewsFeedClientCache());
      setGooglePage(1);
      setAllPage(1);
      setFacebookPage(1);
      setGoogleLocationSummary(null);
      setGoogleStatsError(null);
    }

    try {
      const requests: Promise<void>[] = [];

      requests.push(
        (async () => {
          const params = new URLSearchParams({ restaurantId, platform: "all" });
          const { res, json } = await fetchReviewsJson(params);
          if (!res.ok) {
            toast.error(json.error ?? "Bewertungen konnten nicht geladen werden.");
            return;
          }
          const reviewsRead = json.reviews.map((review) => ({
            ...review,
            isUnread: false,
          }));
          markLoadedReviewsRead(reviewsRead);
          setFeedCache((prev) => ({
            ...prev,
            allPages: { 1: reviewsRead },
            allPagination: json.mergedPagination ?? null,
            allTokenByPage: withNextPageToken(
              1,
              json.mergedPagination?.nextPageToken,
              {},
            ),
            platformTotals:
              json.platformTotals ?? json.mergedPagination?.platformTotals ?? {},
            loadErrors: json.loadErrors ?? {},
            sync: json.sync ?? prev.sync,
          }));
        })(),
      );

      requests.push(
        (async () => {
          const params = new URLSearchParams({ restaurantId, platform: "gwada" });
          const { res, json } = await fetchReviewsJson(params);
          if (!res.ok) return;
          const reviewsRead = json.reviews.map((review) => ({
            ...review,
            isUnread: false,
          }));
          markLoadedReviewsRead(reviewsRead);
          setFeedCache((prev) => ({
            ...prev,
            gwada: reviewsRead,
            platformTotals: {
              ...prev.platformTotals,
              gwada: reviewsRead.length,
            },
          }));
        })(),
      );

      if (googleVisible) {
        requests.push(
          (async () => {
            const params = new URLSearchParams({ restaurantId, platform: "google" });
            const { res, json } = await fetchReviewsJson(params);
            if (!res.ok) return;
            const reviewsRead = json.reviews.map((review) => ({
              ...review,
              isUnread: false,
            }));
            markLoadedReviewsRead(reviewsRead);
            setFeedCache((prev) => ({
              ...prev,
              googlePages: { 1: reviewsRead },
              googlePagination: json.googlePagination ?? null,
              googleTokenByPage: withNextPageToken(
                1,
                json.googlePagination?.nextPageToken,
                {},
              ),
              platformTotals: {
                ...prev.platformTotals,
                google: json.googlePagination?.totalReviewCount ?? reviewsRead.length,
              },
              loadErrors: json.loadError
                ? { ...prev.loadErrors, google: json.loadError }
                : prev.loadErrors,
              sync: json.sync ?? prev.sync,
            }));
          })(),
        );

        requests.push(
          (async () => {
            try {
              const res = await fetch(
                `/api/reviews/google-stats?${new URLSearchParams({ restaurantId })}`,
              );
              const json = (await res.json()) as {
                averageRating?: number | null;
                totalReviewCount?: number;
                loadError?: string;
                error?: string;
              };
              if (!res.ok) {
                setGoogleStatsError(
                  json.loadError ?? json.error ?? "Google-Statistik nicht verfügbar.",
                );
                return;
              }
              const total = Number(json.totalReviewCount ?? 0);
              setGoogleLocationSummary({
                count: total,
                average:
                  typeof json.averageRating === "number" ? json.averageRating : null,
                median: null,
                distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
                scope: "google_location",
              });
              setFeedCache((prev) => ({
                ...prev,
                platformTotals: { ...prev.platformTotals, google: total },
              }));
            } catch {
              setGoogleStatsError("Netzwerkfehler bei Google-Statistik.");
            }
          })(),
        );
      }

      if (facebookVisible) {
        requests.push(
          (async () => {
            const params = new URLSearchParams({ restaurantId, platform: "facebook" });
            const { res, json } = await fetchReviewsJson(params);
            if (!res.ok) return;
            const reviewsRead = json.reviews.map((review) => ({
              ...review,
              isUnread: false,
            }));
            markLoadedReviewsRead(reviewsRead);
            setFeedCache((prev) => ({
              ...prev,
              facebookPages: { 1: reviewsRead },
              facebookPagination: json.facebookPagination ?? null,
              facebookTokenByPage: withNextPageToken(
                1,
                json.facebookPagination?.nextPageToken,
                {},
              ),
              platformTotals: {
                ...prev.platformTotals,
                facebook:
                  json.facebookPagination?.totalReviewCount ?? reviewsRead.length,
              },
              loadErrors: json.loadError
                ? { ...prev.loadErrors, facebook: json.loadError }
                : prev.loadErrors,
              sync: json.sync ?? prev.sync,
            }));
          })(),
        );
      }

      await Promise.all(requests);
      setFeedCache((prev) => ({ ...prev, ready: true }));
    } catch {
      if (!options?.silent) {
        toast.error("Netzwerkfehler beim Laden der Bewertungen.");
      }
    } finally {
      if (!options?.silent) setFeedPrefetchLoading(false);
    }
  }, [
    restaurantId,
    googleVisible,
    facebookVisible,
    fetchReviewsJson,
    markLoadedReviewsRead,
  ]);

  usePlatformFeedSyncRealtime(
    "restaurant_reviews_platform_sync",
    () => {
      void prefetchFeed({ silent: true });
    },
    { enabled: Boolean(restaurantId && ready) },
  );

  const syncNow = useCallback(async () => {
    if (!restaurantId || syncing) return;
    setSyncing(true);
    try {
      const platform =
        platformFilter !== REVIEW_FILTER_ALL &&
        isReviewsCacheablePlatform(platformFilter)
          ? platformFilter
          : undefined;
      const res = await fetch("/api/reviews/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, platform }),
      });
      if (!res.ok) throw new Error("sync_failed");
      await prefetchFeed({ silent: true });
      toast.success("Synchronisiert.");
    } catch {
      toast.error("Synchronisierung fehlgeschlagen.");
    } finally {
      setSyncing(false);
    }
  }, [restaurantId, platformFilter, syncing, prefetchFeed]);

  useEffect(() => {
    if (!feedCache.sync?.stale || feedPrefetchLoading) return;
    let polls = 0;
    const id = window.setInterval(() => {
      if (document.hidden) return;
      polls += 1;
      if (polls > REVIEWS_SYNC_POLL_MAX) {
        window.clearInterval(id);
        return;
      }
      void prefetchFeed({ silent: true });
    }, REVIEWS_SYNC_POLL_MS);
    return () => window.clearInterval(id);
  }, [feedCache.sync?.stale, feedPrefetchLoading, prefetchFeed]);

  const loadAllPage = useCallback(
    async (page: number, opts?: { force?: boolean }) => {
      if (!restaurantId) return;
      if (!opts?.force && feedCache.allPages[page]) {
        setAllPage(page);
        return;
      }
      setPaginationBusy(true);
      try {
        const params = new URLSearchParams({ restaurantId, platform: "all" });
        const token = page <= 1 ? null : (feedCache.allTokenByPage[page] ?? null);
        if (token) params.set("pageToken", token);
        const { res, json } = await fetchReviewsJson(params);
        if (!res.ok) {
          toast.error(json.error ?? "Bewertungen konnten nicht geladen werden.");
          return;
        }
        const reviewsRead = json.reviews.map((review) => ({
          ...review,
          isUnread: false,
        }));
        markLoadedReviewsRead(reviewsRead);
        setFeedCache((prev) => ({
          ...prev,
          allPages: { ...prev.allPages, [page]: reviewsRead },
          allPagination: json.mergedPagination ?? prev.allPagination,
          allTokenByPage: withNextPageToken(
            page,
            json.mergedPagination?.nextPageToken,
            prev.allTokenByPage,
          ),
          platformTotals:
            json.platformTotals ??
            json.mergedPagination?.platformTotals ??
            prev.platformTotals,
          loadErrors: { ...prev.loadErrors, ...(json.loadErrors ?? {}) },
          sync: json.sync ?? prev.sync,
        }));
        setAllPage(page);
      } catch {
        toast.error("Netzwerkfehler beim Laden der Bewertungen.");
      } finally {
        setPaginationBusy(false);
      }
    },
    [restaurantId, feedCache.allPages, feedCache.allTokenByPage, fetchReviewsJson, markLoadedReviewsRead],
  );

  const loadGooglePage = useCallback(
    async (page: number, opts?: { force?: boolean }) => {
      if (!restaurantId) return;
      if (!opts?.force && feedCache.googlePages[page]) {
        setGooglePage(page);
        return;
      }
      setPaginationBusy(true);
      try {
        const params = new URLSearchParams({ restaurantId, platform: "google" });
        const token =
          page <= 1 ? null : (feedCache.googleTokenByPage[page] ?? null);
        if (token) params.set("googlePageToken", token);
        const { res, json } = await fetchReviewsJson(params);
        if (!res.ok) {
          toast.error(json.error ?? "Bewertungen konnten nicht geladen werden.");
          return;
        }
        const reviewsRead = json.reviews.map((review) => ({
          ...review,
          isUnread: false,
        }));
        markLoadedReviewsRead(reviewsRead);
        setFeedCache((prev) => ({
          ...prev,
          googlePages: { ...prev.googlePages, [page]: reviewsRead },
          googlePagination: json.googlePagination ?? prev.googlePagination,
          googleTokenByPage: withNextPageToken(
            page,
            json.googlePagination?.nextPageToken,
            prev.googleTokenByPage,
          ),
          sync: json.sync ?? prev.sync,
        }));
        setGooglePage(page);
      } catch {
        toast.error("Netzwerkfehler beim Laden der Bewertungen.");
      } finally {
        setPaginationBusy(false);
      }
    },
    [
      restaurantId,
      feedCache.googlePages,
      feedCache.googleTokenByPage,
      fetchReviewsJson,
      markLoadedReviewsRead,
    ],
  );

  const loadFacebookPage = useCallback(
    async (page: number, opts?: { force?: boolean }) => {
      if (!restaurantId) return;
      if (!opts?.force && feedCache.facebookPages[page]) {
        setFacebookPage(page);
        return;
      }
      setPaginationBusy(true);
      try {
        const params = new URLSearchParams({ restaurantId, platform: "facebook" });
        const token =
          page <= 1 ? null : (feedCache.facebookTokenByPage[page] ?? null);
        if (token) params.set("pageToken", token);
        const { res, json } = await fetchReviewsJson(params);
        if (!res.ok) {
          toast.error(json.error ?? "Bewertungen konnten nicht geladen werden.");
          return;
        }
        const reviewsRead = json.reviews.map((review) => ({
          ...review,
          isUnread: false,
        }));
        markLoadedReviewsRead(reviewsRead);
        setFeedCache((prev) => ({
          ...prev,
          facebookPages: { ...prev.facebookPages, [page]: reviewsRead },
          facebookPagination: json.facebookPagination ?? prev.facebookPagination,
          facebookTokenByPage: withNextPageToken(
            page,
            json.facebookPagination?.nextPageToken,
            prev.facebookTokenByPage,
          ),
          sync: json.sync ?? prev.sync,
        }));
        setFacebookPage(page);
      } catch {
        toast.error("Netzwerkfehler beim Laden der Bewertungen.");
      } finally {
        setPaginationBusy(false);
      }
    },
    [
      restaurantId,
      feedCache.facebookPages,
      feedCache.facebookTokenByPage,
      fetchReviewsJson,
      markLoadedReviewsRead,
    ],
  );

  const prefetchFeedRef = useRef(prefetchFeed);
  prefetchFeedRef.current = prefetchFeed;

  const reloadCurrent = useCallback(() => {
    const force = { force: true as const };
    if (isGooglePaginated) {
      void loadGooglePage(googlePage, force);
      return;
    }
    if (isAllPaginated) {
      void loadAllPage(allPage, force);
      return;
    }
    if (isFacebookPaginated) {
      void loadFacebookPage(facebookPage, force);
      return;
    }
    void prefetchFeed();
  }, [
    loadGooglePage,
    loadAllPage,
    loadFacebookPage,
    prefetchFeed,
    isGooglePaginated,
    isAllPaginated,
    isFacebookPaginated,
    googlePage,
    allPage,
    facebookPage,
  ]);

  useEffect(() => {
    if (!restaurantId || connectionsLoading) return;
    setSearch("");
    setRatingFilter("all");
    setCommentFilter("all");
    setReplyFilter("all");
    setReadFilter("all");
    setReadLocal({});
    setSortKey("created_desc");
    void prefetchFeedRef.current();
  }, [restaurantId, connectionsLoading, googleVisible, facebookVisible]);

  useEffect(() => {
    if (!restaurantId || !platformViewReady) return;
    if (readAllStartedRef.current === restaurantId) return;
    readAllStartedRef.current = restaurantId;
    void markAllReviewsReadClient(restaurantId).then(({ ok }) => {
      if (ok) {
        setReadLocal({});
        setFeedCache((prev) => markReviewsReadInFeedCache(prev, [
          ...prev.gwada,
          ...Object.values(prev.allPages).flat(),
          ...Object.values(prev.googlePages).flat(),
          ...Object.values(prev.facebookPages).flat(),
        ]));
      }
    });
  }, [restaurantId, platformViewReady]);

  const submitReply = async () => {
    if (!restaurantId || !replyTarget || !replyText.trim()) return;
    setReplyBusy(true);
    try {
      const res = await fetch("/api/reviews/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          platform: replyTarget.platform,
          reviewId: replyTarget.id,
          comment: replyText.trim(),
        }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(body.error ?? "Antwort konnte nicht gesendet werden.");
        return;
      }
      toast.success("Antwort gesendet.");
      setReplyTarget(null);
      setReplyText("");
      reloadCurrent();
      if (isGooglePaginated && googleLocationSummary == null) {
        void prefetchFeedRef.current();
      }
    } finally {
      setReplyBusy(false);
    }
  };

  const patchReviewInState = useCallback(
    (review: UnifiedReview, patch: Partial<UnifiedReview>) => {
      setFeedCache((prev) => patchReviewInFeedCache(prev, review, patch));
    },
    [],
  );

  const toggleReviewVisibility = useCallback(
    async (review: UnifiedReview) => {
      if (!restaurantId) return;
      const busyKey = `${review.platform}:${review.id}`;
      setVisibilityBusyKey(busyKey);
      const hidden = !review.hiddenFromPublic;
      try {
        const res = await fetch("/api/reviews/visibility", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            restaurantId,
            platform: review.platform,
            reviewId: review.id,
            hidden,
          }),
        });
        const body = (await res.json()) as { error?: string };
        if (!res.ok) {
          toast.error(body.error ?? "Sichtbarkeit konnte nicht geändert werden.");
          return;
        }
        patchReviewInState(review, { hiddenFromPublic: hidden });
        toast.success(
          hidden
            ? "Bewertung auf Profil und Embed ausgeblendet."
            : "Bewertung wieder auf Profil und Embed sichtbar.",
        );
      } catch {
        toast.error("Netzwerkfehler beim Ändern der Sichtbarkeit.");
      } finally {
        setVisibilityBusyKey(null);
      }
    },
    [restaurantId, patchReviewInState],
  );

  const toggleReviewPin = useCallback(
    async (review: UnifiedReview) => {
      if (!restaurantId) return;
      const busyKey = `${review.platform}:${review.id}`;
      setPinBusyKey(busyKey);
      const nextPinned = !review.isPinned;
      try {
        const result = await setFeedItemPin({
          restaurantId,
          module: "reviews",
          platform: review.platform,
          itemId: review.id,
          pinned: nextPinned,
        });
        if ("error" in result) {
          toast.error("Anpinnen fehlgeschlagen.");
          return;
        }
        patchReviewInState(review, { isPinned: result.isPinned });
        toast.success(
          result.isPinned
            ? "Bewertung angepinnt — erscheint oben im Feed."
            : "Pin entfernt.",
        );
      } catch {
        toast.error("Netzwerkfehler beim Anpinnen.");
      } finally {
        setPinBusyKey(null);
      }
    },
    [restaurantId, patchReviewInState],
  );

  const openReservationDrawer = useCallback(
    async (review: UnifiedReview) => {
      if (!restaurantId || !review.reservationId) return;
      setReservationDrawerOpen(true);
      setReservationDrawerRow(null);
      const { data, error } = await fetchReservationById({
        restaurantId,
        id: review.reservationId,
      });
      if (error || !data) {
        toast.error("Reservierung nicht gefunden.");
        setReservationDrawerOpen(false);
        return;
      }
      setReservationDrawerRow(data);
    },
    [restaurantId],
  );

  const googleTotalPages = googlePagination
    ? googleReviewsTotalPages(googlePagination.totalReviewCount)
    : 1;

  const goGooglePrevious = () => {
    if (googlePage <= 1 || paginationBusy) return;
    void loadGooglePage(googlePage - 1);
  };

  const goGoogleNext = () => {
    if (paginationBusy) return;
    if (
      feedCache.googlePages[googlePage + 1] ||
      feedCache.googleTokenByPage[googlePage + 1]
    ) {
      void loadGooglePage(googlePage + 1);
    }
  };

  const allTotalPages = mergedPagination
    ? reviewListTotalPages(mergedPagination.totalReviewCount)
    : 1;

  const goAllPrevious = () => {
    if (allPage <= 1 || paginationBusy) return;
    void loadAllPage(allPage - 1);
  };

  const goAllNext = () => {
    if (paginationBusy) return;
    if (feedCache.allPages[allPage + 1] || feedCache.allTokenByPage[allPage + 1]) {
      void loadAllPage(allPage + 1);
    }
  };

  const facebookTotalPages = facebookPagination
    ? reviewListTotalPages(facebookPagination.totalReviewCount)
    : 1;

  const goFacebookPrevious = () => {
    if (facebookPage <= 1 || paginationBusy) return;
    void loadFacebookPage(facebookPage - 1);
  };

  const goFacebookNext = () => {
    if (paginationBusy) return;
    if (
      feedCache.facebookPages[facebookPage + 1] ||
      feedCache.facebookTokenByPage[facebookPage + 1]
    ) {
      void loadFacebookPage(facebookPage + 1);
    }
  };

  const loadError = useMemo(() => {
    if (platformFilter === "google") {
      return mergedLoadErrors.google ?? null;
    }
    if (platformFilter === "facebook") {
      return mergedLoadErrors.facebook ?? null;
    }
    if (platformFilter === REVIEW_FILTER_ALL) {
      return null;
    }
    return mergedLoadErrors[platformFilter] ?? null;
  }, [platformFilter, mergedLoadErrors]);

  const mergedLoadErrorEntries = useMemo(
    () =>
      Object.entries(mergedLoadErrors) as [ReviewPlatform, string][],
    [mergedLoadErrors],
  );

  const hasReviewData = feedCache.ready && !feedPrefetchLoading;

  const reviewIsUnread = useCallback(
    (review: UnifiedReview) => {
      const key = reviewReadLookupKey(review.platform, review.id);
      if (key in readLocal) return readLocal[key]!;
      return review.isUnread !== false;
    },
    [readLocal],
  );

  const markReviewUnread = useCallback(
    async (review: UnifiedReview) => {
      if (!restaurantId || reviewIsUnread(review)) return;
      const key = reviewReadLookupKey(review.platform, review.id);
      setReadLocal((prev) => ({ ...prev, [key]: true }));
      const { ok, error } = await markReviewUnreadClient({
        restaurantId,
        platform: review.platform,
        reviewId: review.id,
      });
      if (!ok) {
        setReadLocal((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        toast.error(error ?? "Konnte nicht als ungelesen markieren.");
      }
    },
    [restaurantId, reviewIsUnread],
  );

  const reviewsWithReadState = useMemo(
    () =>
      allReviews.map((review) => ({
        ...review,
        isUnread: reviewIsUnread(review),
      })),
    [allReviews, reviewIsUnread],
  );

  const filteredSortedReviews = useMemo(() => {
    const filtered = filterReviews(reviewsWithReadState, {
      search,
      ratingFilter,
      commentFilter,
      replyFilter,
      showReplyFilter,
      readFilter,
    });
    return sortReviews(filtered, sortKey);
  }, [
    reviewsWithReadState,
    search,
    ratingFilter,
    commentFilter,
    replyFilter,
    showReplyFilter,
    readFilter,
    sortKey,
  ]);

  const filteredSummary = useMemo(
    () => ({
      count: filteredSortedReviews.length,
      average: averageRating(filteredSortedReviews),
      median: medianRating(filteredSortedReviews),
      distribution: ratingDistribution(filteredSortedReviews),
      scope: "page" as const,
    }),
    [filteredSortedReviews],
  );

  const mergedGrandTotal = useMemo(() => {
    if (platformFilter !== REVIEW_FILTER_ALL) return null;
    if (typeof mergedPagination?.totalReviewCount === "number") {
      return mergedPagination.totalReviewCount;
    }
    const platforms: ReviewPlatform[] = ["gwada"];
    if (googleVisible) platforms.push("google");
    if (facebookVisible) platforms.push("facebook");
    let sum = 0;
    let hasAny = false;
    for (const platform of platforms) {
      const count = mergedPlatformTotals[platform];
      if (typeof count === "number") {
        sum += count;
        hasAny = true;
      }
    }
    return hasAny ? sum : null;
  }, [
    platformFilter,
    mergedPagination?.totalReviewCount,
    mergedPlatformTotals,
    googleVisible,
    facebookVisible,
  ]);

  const drawerFilterActiveCount = useMemo(
    () =>
      countReviewsDrawerActiveFilters({
        readFilter,
        ratingFilter,
        commentFilter,
        replyFilter,
        showReplyFilter,
        sortKey,
      }),
    [
      readFilter,
      ratingFilter,
      commentFilter,
      replyFilter,
      showReplyFilter,
      sortKey,
    ],
  );

  const getReviewCardProps = useCallback(
    (review: UnifiedReview) => {
      const busyKey = `${review.platform}:${review.id}`;
      return {
        isUnread: review.isUnread,
        visibilityBusy: visibilityBusyKey === busyKey,
        pinBusy: pinBusyKey === busyKey,
        onMarkUnread: () => void markReviewUnread(review),
        onProtocol:
          review.platform === "gwada"
            ? () => setProtocolReview(review)
            : undefined,
        onOpenContact: review.contactId
          ? () => {
              setContactDrawerId(review.contactId!);
              setContactDrawerOpen(true);
            }
          : undefined,
        onOpenReservation: review.reservationId
          ? () => void openReservationDrawer(review)
          : undefined,
        onReply: review.canReply
          ? () => {
              setReplyTarget(review);
              setReplyText(review.reply ?? "");
            }
          : undefined,
        onToggleHidden: () => void toggleReviewVisibility(review),
        onTogglePin: () => void toggleReviewPin(review),
      };
    },
    [
      visibilityBusyKey,
      pinBusyKey,
      markReviewUnread,
      openReservationDrawer,
      toggleReviewVisibility,
      toggleReviewPin,
    ],
  );

  const filtersActive =
    hasActiveReviewFilters({
      search,
      ratingFilter,
      commentFilter,
      replyFilter,
      showReplyFilter,
      readFilter,
    }) || sortKey !== "created_desc";

  const reviewCountSummary = useMemo(() => {
    if (isGooglePaginated && googlePagination) {
      if (filtersActive) {
        return `${filteredSortedReviews.length} von ${allReviews.length} auf dieser Seite (Seite ${googlePage}/${googleTotalPages})`;
      }
      return `${allReviews.length} auf dieser Seite · insgesamt ${googleLocationSummary?.count ?? googlePagination.totalReviewCount} bei Google`;
    }
    if (isFacebookPaginated && facebookPagination) {
      if (filtersActive) {
        return `${filteredSortedReviews.length} von ${allReviews.length} auf dieser Seite (Seite ${facebookPage}/${facebookTotalPages})`;
      }
      return `${allReviews.length} auf dieser Seite · insgesamt ${facebookPagination.totalReviewCount} bei Facebook`;
    }
    if (isAllPaginated && mergedPagination) {
      if (filtersActive) {
        return `${filteredSortedReviews.length} von ${allReviews.length} auf dieser Seite (Seite ${allPage}/${allTotalPages})`;
      }
      return `${allReviews.length} auf dieser Seite · insgesamt ${mergedPagination.totalReviewCount} Bewertungen`;
    }
    if (filtersActive) {
      return `${filteredSortedReviews.length} von ${allReviews.length} Bewertungen`;
    }
    return `${allReviews.length} Bewertungen`;
  }, [
    isGooglePaginated,
    googlePagination,
    filtersActive,
    filteredSortedReviews.length,
    allReviews.length,
    googlePage,
    googleTotalPages,
    googleLocationSummary?.count,
    isFacebookPaginated,
    facebookPagination,
    facebookPage,
    facebookTotalPages,
    isAllPaginated,
    mergedPagination,
    allPage,
    allTotalPages,
  ]);

  const reviewFeedSync = useMemo(
    () => ({
      syncMeta: feedCache.sync,
      syncing,
      onSyncNow: () => void syncNow(),
    }),
    [feedCache.sync, syncing, syncNow],
  );

  const summaryForCard = useMemo(() => {
    if (isGooglePaginated && !filtersActive && googleLocationSummary) {
      return googleLocationSummary;
    }
    if (
      platformFilter === REVIEW_FILTER_ALL &&
      !filtersActive &&
      mergedGrandTotal != null
    ) {
      return { ...filteredSummary, count: mergedGrandTotal };
    }
    return filteredSummary;
  }, [
    isGooglePaginated,
    filtersActive,
    googleLocationSummary,
    filteredSummary,
    platformFilter,
    mergedGrandTotal,
  ]);

  if (!ready) {
    return <WorkspaceRestaurantResolvePlaceholder />;
  }
  if (!restaurantId) {
    return <WorkspaceRestaurantMissingMessage />;
  }

  if (!permissionsLoading && !canRead) {
    return <ModuleAccessDenied label="Bewertungen" />;
  }

  const resetFilters = () => {
    setSearch("");
    setRatingFilter("all");
    setCommentFilter("all");
    setReplyFilter("all");
    setReadFilter("all");
    setSortKey("created_desc");
  };

  return (
    <div className="flex w-full min-w-0 flex-col gap-4 pt-2">
      <ReviewInboxFilterChips
        filter={platformFilter}
        onFilterChange={selectPlatformFilter}
        isPlatformAvailable={isPlatformAvailable}
        disabled={connectionsLoading}
      />

      {!connectionsLoading && platformFilter === "google" && !googleVisible ? (
        <p className="text-sm text-muted-foreground">
          Google ist für dieses Restaurant nicht verfügbar oder nicht verbunden.
        </p>
      ) : null}

      {!connectionsLoading && platformFilter === "facebook" && !facebookVisible ? (
        <p className="text-sm text-muted-foreground">
          Facebook ist für dieses Restaurant nicht verfügbar oder nicht verbunden.
        </p>
      ) : null}

      {platformViewReady ? (
      <div className="space-y-6">
      {platformFilter === "gwada" && !feedPrefetchLoading && !showSkeleton ? (
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <p className="max-w-2xl text-sm text-muted-foreground">
              Gwada-Bewertungen können je nach Einstellung automatisch nach
              Reservierungen angefragt werden — oder du erstellst und versendest
              hier manuell Einladungslinks (24 Stunden gültig). Automatik und Kanäle
              unter{" "}
              <a
                href="/dashboard/reservierungen/einstellungen"
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                Reservierungen → Einstellungen
              </a>
              .
            </p>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-11 shrink-0 rounded-xl"
              aria-label="Gesamtprotokoll Bewertungen"
              onClick={() => setOverviewProtocolOpen(true)}
            >
              <ScrollText className="size-4" />
            </Button>
          </div>
          <Button
            type="button"
            size="lg"
            className={modulePrimaryAddButtonFullWidthClassName}
            onClick={() => setInviteSheetOpen(true)}
          >
            <Link2 className="size-4" />
            Bewertungslink erstellen
          </Button>
        </div>
      ) : null}

      {loadError && !feedPrefetchLoading ? (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 text-sm text-destructive">
            {platformFilter === "google"
              ? "Google-Bewertungen konnten nicht geladen werden. Prüfe die Verbindung unter Einstellungen → Integrationen."
              : "Facebook-Empfehlungen konnten nicht geladen werden. Meta stellt Page-Ratings regional unterschiedlich bereit — Verbindung und Berechtigungen prüfen."}
            <span className="mt-1 block text-xs opacity-80">{loadError}</span>
          </CardContent>
        </Card>
      ) : null}

      {platformFilter === REVIEW_FILTER_ALL &&
      mergedLoadErrorEntries.length > 0 &&
      !feedPrefetchLoading ? (
        <div className="space-y-2">
          {mergedLoadErrorEntries.map(([platform, message]) => (
            <Card
              key={platform}
              className="border-amber-500/30 bg-amber-500/5"
            >
              <CardContent className="p-4 text-sm text-foreground">
                {platform === "google"
                  ? "Google-Bewertungen konnten nicht geladen werden."
                  : "Facebook-Empfehlungen konnten nicht geladen werden."}
                <span className="mt-1 block text-xs text-muted-foreground">
                  {message}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {platformFilter === "google" && googleStatsError && !googleLocationSummary ? (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4 text-sm text-foreground">
            Google-Durchschnitt konnte nicht geladen werden.
            <span className="mt-1 block text-xs text-muted-foreground">
              {googleStatsError}
            </span>
          </CardContent>
        </Card>
      ) : null}

      {feedPrefetchLoading && !showSkeleton ? (
        <div className="min-h-[24rem]" aria-busy="true" />
      ) : null}

      {showSkeleton ? (
        <ReviewsScreenSkeleton viewMode={viewMode} />
      ) : hasReviewData ? (
        <>
          <ReviewSummaryCard summary={summaryForCard} />

          {allReviews.length > 0 ? (
            <div className="space-y-3">
              <div className={moduleSearchFilterRowClassName}>
                <div className={moduleSearchFieldWrapClassName}>
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Kommentar, Name oder Antwort …"
                    className={moduleSearchInputClassName}
                    aria-label="Bewertungen durchsuchen"
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
                <div className={moduleSearchFilterButtonWrapClassName}>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-lg"
                    className={moduleSearchFilterButtonClassName}
                    aria-label="Filter und Sortierung"
                    onClick={() => setFilterOpen(true)}
                  >
                    <Filter className="size-4" />
                  </Button>
                  {drawerFilterActiveCount > 0 ? (
                    <Badge
                      variant="secondary"
                      className={moduleSearchFilterActiveBadgeClassName}
                    >
                      {drawerFilterActiveCount}
                    </Badge>
                  ) : null}
                </div>
              </div>
              <PlatformFeedListMetaRow
                summaryPrefix={reviewCountSummary}
                feedSync={reviewFeedSync}
                placement="above"
                className="border-b-0 pb-0"
                trailing={
                  filtersActive ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 text-muted-foreground"
                      onClick={resetFilters}
                    >
                      Filter zurücksetzen
                    </Button>
                  ) : null
                }
              />
              {isGooglePaginated && filtersActive ? (
                <p className="text-xs text-muted-foreground">
                  Filter und Sortierung gelten nur für die aktuelle Seite.
                </p>
              ) : (isAllPaginated || isFacebookPaginated) && filtersActive ? (
                <p className="text-xs text-muted-foreground">
                  Filter und Sortierung gelten nur für die aktuelle Seite.
                </p>
              ) : null}
            </div>
          ) : null}

          {allReviews.length === 0 ? (
            <>
              {platformFeedSyncMetaVisible(feedCache.sync) ? (
                <PlatformFeedListMetaRow
                  feedSync={reviewFeedSync}
                  placement="above"
                  className="border-b-0 pb-0"
                />
              ) : null}
            <Card className="border-border/50 shadow-card">
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                {platformFilter === REVIEW_FILTER_ALL
                  ? "Noch keine Bewertungen."
                  : "Noch keine Bewertungen auf dieser Plattform."}
              </CardContent>
            </Card>
            </>
          ) : filteredSortedReviews.length === 0 ? (
            <Card className="border-border/50 shadow-card">
              <CardContent className="flex flex-col items-center gap-3 p-8 text-center text-sm text-muted-foreground">
                <p>Keine Treffer für Suche oder Filter.</p>
                {filtersActive ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={resetFilters}
                  >
                    Filter zurücksetzen
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ) : (
            <>
              {isGooglePaginated && googlePagination ? (
                <ReviewsPaginationSurround
                  page={googlePage}
                  totalPages={googleTotalPages}
                  onPrevious={goGooglePrevious}
                  onNext={goGoogleNext}
                  canPrevious={googlePage > 1}
                  canNext={
                    Boolean(feedCache.googlePages[googlePage + 1]) ||
                    Boolean(feedCache.googleTokenByPage[googlePage + 1])
                  }
                  busy={paginationBusy}
                >
                  {viewMode === "list" ? (
                    <ReviewsListView
                      reviews={filteredSortedReviews}
                      showPlatform={false}
                      getReviewProps={getReviewCardProps}
                    />
                  ) : (
                    <ReviewsGridView
                      reviews={filteredSortedReviews}
                      showPlatform={false}
                      getReviewProps={getReviewCardProps}
                    />
                  )}
                </ReviewsPaginationSurround>
              ) : isAllPaginated && mergedPagination ? (
                <ReviewsPaginationSurround
                  page={allPage}
                  totalPages={allTotalPages}
                  onPrevious={goAllPrevious}
                  onNext={goAllNext}
                  canPrevious={allPage > 1}
                  canNext={
                    Boolean(feedCache.allPages[allPage + 1]) ||
                    Boolean(feedCache.allTokenByPage[allPage + 1])
                  }
                  busy={paginationBusy}
                >
                  {viewMode === "list" ? (
                    <ReviewsListView
                      reviews={filteredSortedReviews}
                      showPlatform={true}
                      getReviewProps={getReviewCardProps}
                    />
                  ) : (
                    <ReviewsGridView
                      reviews={filteredSortedReviews}
                      showPlatform={true}
                      getReviewProps={getReviewCardProps}
                    />
                  )}
                </ReviewsPaginationSurround>
              ) : isFacebookPaginated && facebookPagination ? (
                <ReviewsPaginationSurround
                  page={facebookPage}
                  totalPages={facebookTotalPages}
                  onPrevious={goFacebookPrevious}
                  onNext={goFacebookNext}
                  canPrevious={facebookPage > 1}
                  canNext={
                    Boolean(feedCache.facebookPages[facebookPage + 1]) ||
                    Boolean(feedCache.facebookTokenByPage[facebookPage + 1])
                  }
                  busy={paginationBusy}
                >
                  {viewMode === "list" ? (
                    <ReviewsListView
                      reviews={filteredSortedReviews}
                      showPlatform={false}
                      getReviewProps={getReviewCardProps}
                    />
                  ) : (
                    <ReviewsGridView
                      reviews={filteredSortedReviews}
                      showPlatform={false}
                      getReviewProps={getReviewCardProps}
                    />
                  )}
                </ReviewsPaginationSurround>
              ) : viewMode === "list" ? (
                <ReviewsListView
                  reviews={filteredSortedReviews}
                  showPlatform={platformFilter === REVIEW_FILTER_ALL}
                  getReviewProps={getReviewCardProps}
                />
              ) : (
                <ReviewsGridView
                  reviews={filteredSortedReviews}
                  showPlatform={platformFilter === REVIEW_FILTER_ALL}
                  getReviewProps={getReviewCardProps}
                />
              )}
            </>
          )}
        </>
      ) : null}

      <Dialog
        open={replyTarget != null}
        onOpenChange={(open) => {
          if (!open) setReplyTarget(null);
        }}
      >
        <DialogContent className="max-w-md border-border/50 shadow-card">
          <DialogHeader>
            <DialogTitle>Antwort verfassen</DialogTitle>
            <DialogDescription>
              Deine Antwort wird bei{" "}
              {replyTarget?.platform === "google" ? "Google" : "Facebook"}{" "}
              veröffentlicht.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            rows={4}
            placeholder="Danke für dein Feedback …"
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setReplyTarget(null)}>
              Abbrechen
            </Button>
            <Button
              type="button"
              className={settingsAccentSaveButtonClassName}
              disabled={replyBusy || !replyText.trim()}
              onClick={() => void submitReply()}
            >
              {replyBusy ? "Senden…" : "Antwort senden"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReviewInvitationSheet
        open={inviteSheetOpen}
        onOpenChange={setInviteSheetOpen}
        restaurantId={restaurantId}
        restaurantName={restaurantDisplayName}
        defaultCountryIso2={defaultCountryIso2}
      />

      <GwadaReviewProtocolDrawer
        scope="review"
        open={protocolReview !== null}
        onOpenChange={(open) => {
          if (!open) {
            setProtocolReview(null);
            if (reviewProtocolParam) {
              const params = new URLSearchParams(searchParams.toString());
              params.delete("reviewProtocol");
              const q = params.toString();
              router.replace(
                q
                  ? `/dashboard/bewertungen/uebersicht?${q}`
                  : "/dashboard/bewertungen/uebersicht?platform=gwada",
              );
            }
          }
        }}
        restaurantId={restaurantId}
        reviewId={protocolReview?.id ?? null}
        reviewLabel={
          protocolReview
            ? `${protocolReview.rating}★ · ${new Date(protocolReview.createdAt).toLocaleDateString("de-DE")}`
            : ""
        }
      />

      <GwadaReviewProtocolDrawer
        scope="overview"
        open={overviewProtocolOpen}
        onOpenChange={setOverviewProtocolOpen}
        restaurantId={restaurantId}
      />

      {restaurantId ? (
        <ContactEditDrawer
          open={contactDrawerOpen}
          onOpenChange={(open) => {
            setContactDrawerOpen(open);
            if (!open) setContactDrawerId(null);
          }}
          contactId={contactDrawerId}
          restaurantId={restaurantId}
          defaultCountryIso2={defaultCountryIso2}
        />
      ) : null}

      <ReservationEditDrawer
        open={reservationDrawerOpen}
        onOpenChange={(open) => {
          setReservationDrawerOpen(open);
          if (!open) setReservationDrawerRow(null);
        }}
        reservation={reservationDrawerRow}
        createFor={null}
        overlapReservations={[]}
        onSaved={() => {
          setReservationDrawerOpen(false);
          setReservationDrawerRow(null);
        }}
      />

      <ReviewsFilterDrawer
        open={filterOpen}
        onOpenChange={setFilterOpen}
        readFilter={readFilter}
        onReadFilterChange={setReadFilter}
        ratingFilter={ratingFilter}
        onRatingFilterChange={setRatingFilter}
        commentFilter={commentFilter}
        onCommentFilterChange={setCommentFilter}
        replyFilter={replyFilter}
        onReplyFilterChange={setReplyFilter}
        showReplyFilter={showReplyFilter}
        sortKey={sortKey}
        onSortKeyChange={setSortKey}
      />
      </div>
      ) : null}
    </div>
  );
}
