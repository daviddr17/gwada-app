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
import { ReviewsPagination } from "@/components/reviews/reviews-pagination";
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
  type ReviewPlatform,
  type ReviewPlatformFilter,
} from "@/lib/constants/review-platforms";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useReviewPlatformConnections } from "@/lib/hooks/use-review-platform-connections";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import type { UnifiedReview } from "@/lib/reviews/unified-review";
import {
  patchReviewsScreenQueryUrl,
  readReviewsScreenQueryFromSearch,
  type ReviewViewMode,
} from "@/lib/reviews/reviews-screen-query";
import {
  fetchReservationById,
  type ReservationListRow,
} from "@/lib/supabase/reservations-db";
import {
  filterReviews,
  filterReviewsByPlatform,
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
  loadError?: string | null;
};

type GoogleLocationSummary = {
  count: number;
  average: number | null;
  median: null;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
  scope: "google_location";
};

export function ReviewsScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const platformParam = searchParams.get("platform");
  const { restaurantId, ready } = useWorkspaceRestaurantUuid();
  const {
    loading: connectionsLoading,
    googleConnected,
    facebookConnected,
  } = useReviewPlatformConnections(restaurantId);
  const [platformFilter, setPlatformFilter] = useState<ReviewPlatformFilter>(() =>
    parseReviewPlatformFilter(platformParam),
  );
  const [mergedLoading, setMergedLoading] = useState(true);
  const [mergedReviews, setMergedReviews] = useState<UnifiedReview[]>([]);
  const [mergedLoadErrors, setMergedLoadErrors] = useState<
    Partial<Record<ReviewPlatform, string>>
  >({});
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleData, setGoogleData] = useState<ReviewsApiResponse | null>(null);
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
  const [googlePage, setGooglePage] = useState(1);
  const [googleTokenByPage, setGoogleTokenByPage] = useState<
    Record<number, string>
  >({});
  const [googlePagination, setGooglePagination] =
    useState<GoogleReviewsPaginationMeta | null>(null);
  const [googleLocationSummary, setGoogleLocationSummary] =
    useState<GoogleLocationSummary | null>(null);
  const [googleStatsError, setGoogleStatsError] = useState<string | null>(null);
  const [googleStatsLoading, setGoogleStatsLoading] = useState(false);
  const [inviteSheetOpen, setInviteSheetOpen] = useState(false);
  const [viewMode, setViewModeState] = useState<ReviewViewMode>(() =>
    readReviewsScreenQueryFromSearch(searchParams.toString()).viewMode,
  );
  const [reservationDrawerOpen, setReservationDrawerOpen] = useState(false);
  const [reservationDrawerRow, setReservationDrawerRow] =
    useState<ReservationListRow | null>(null);
  const [visibilityBusyKey, setVisibilityBusyKey] = useState<string | null>(null);

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
  const loading = isGooglePaginated ? googleLoading : mergedLoading;
  const showSkeleton = useDeferredSkeleton(loading);
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
      if (p === "google") return googleConnected;
      if (p === "facebook") return facebookConnected;
      return false;
    },
    [googleConnected, facebookConnected],
  );

  const platformViewReady =
    platformFilter === REVIEW_FILTER_ALL ||
    isPlatformAvailable(platformFilter);

  const reviewProtocolParam = searchParams.get("reviewProtocol")?.trim() ?? "";

  const allReviews = useMemo(() => {
    if (platformFilter === "google") {
      return googleData?.reviews ?? [];
    }
    return filterReviewsByPlatform(mergedReviews, platformFilter);
  }, [platformFilter, mergedReviews, googleData?.reviews]);

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

  const loadMerged = useCallback(async () => {
    if (!restaurantId) {
      setMergedLoading(false);
      return;
    }
    setMergedLoading(true);
    setMergedLoadErrors({});
    try {
      const platforms: ReviewPlatform[] = ["gwada"];
      if (googleConnected) platforms.push("google");
      if (facebookConnected) platforms.push("facebook");

      const results = await Promise.all(
        platforms.map(async (platform) => {
          const params = new URLSearchParams({ restaurantId, platform });
          const res = await fetch(`/api/reviews?${params}`);
          const json = (await res.json()) as ReviewsApiResponse & {
            error?: string;
          };
          return { platform, ok: res.ok, json };
        }),
      );

      const reviews: UnifiedReview[] = [];
      const errors: Partial<Record<ReviewPlatform, string>> = {};

      for (const result of results) {
        if (result.ok && Array.isArray(result.json.reviews)) {
          reviews.push(
            ...result.json.reviews.map((review) => ({
              ...review,
              isUnread: false,
            })),
          );
        } else {
          const err =
            result.json.loadError ??
            result.json.error ??
            "Bewertungen konnten nicht geladen werden.";
          errors[result.platform] = err;
        }
      }

      setMergedReviews(reviews);
      setMergedLoadErrors(errors);
      if (reviews.length > 0) {
        markLoadedReviewsRead(reviews);
      }
    } catch {
      toast.error("Netzwerkfehler beim Laden der Bewertungen.");
      setMergedReviews([]);
    } finally {
      setMergedLoading(false);
    }
  }, [restaurantId, googleConnected, facebookConnected, markLoadedReviewsRead]);

  const loadGoogle = useCallback(
    async (opts?: { googlePage?: number; googlePageToken?: string | null }) => {
      if (!restaurantId) {
        setGoogleLoading(false);
        return;
      }
      setGoogleLoading(true);
      try {
        const params = new URLSearchParams({ restaurantId, platform: "google" });
        const page = opts?.googlePage ?? 1;
        const token =
          opts?.googlePageToken !== undefined
            ? opts.googlePageToken
            : page <= 1
              ? null
              : (googleTokenByPage[page] ?? null);
        if (token) params.set("googlePageToken", token);

        const res = await fetch(`/api/reviews?${params}`);
        const json = (await res.json()) as ReviewsApiResponse & { error?: string };
        if (!res.ok) {
          toast.error(json.error ?? "Bewertungen konnten nicht geladen werden.");
          setGoogleData(null);
          return;
        }
        const reviewsRead = json.reviews.map((review) => ({
          ...review,
          isUnread: false,
        }));
        setGoogleData({ ...json, reviews: reviewsRead });
        markLoadedReviewsRead(reviewsRead);

        if (json.googlePagination) {
          setGooglePage(page);
          setGooglePagination(json.googlePagination);
          const next = json.googlePagination.nextPageToken;
          if (next) {
            setGoogleTokenByPage((prev) => ({ ...prev, [page + 1]: next }));
          }
        }
      } catch {
        toast.error("Netzwerkfehler beim Laden der Bewertungen.");
        setGoogleData(null);
      } finally {
        setGoogleLoading(false);
      }
    },
    [restaurantId, googleTokenByPage, markLoadedReviewsRead],
  );

  const loadMergedRef = useRef(loadMerged);
  loadMergedRef.current = loadMerged;
  const loadGoogleRef = useRef(loadGoogle);
  loadGoogleRef.current = loadGoogle;

  const loadGoogleStats = useCallback(async () => {
    if (!restaurantId || !isGooglePaginated) return;
    setGoogleStatsLoading(true);
    setGoogleStatsError(null);
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
        const err = json.loadError ?? json.error ?? "Google-Statistik nicht verfügbar.";
        setGoogleStatsError(err);
        setGoogleLocationSummary(null);
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
    } catch {
      setGoogleStatsError("Netzwerkfehler bei Google-Statistik.");
      setGoogleLocationSummary(null);
    } finally {
      setGoogleStatsLoading(false);
    }
  }, [restaurantId, isGooglePaginated]);

  const reloadCurrent = useCallback(() => {
    if (isGooglePaginated) {
      void loadGoogle({
        googlePage,
        googlePageToken:
          googlePage <= 1 ? null : (googleTokenByPage[googlePage] ?? null),
      });
      return;
    }
    void loadMerged();
  }, [loadGoogle, loadMerged, isGooglePaginated, googlePage, googleTokenByPage]);

  useEffect(() => {
    if (!restaurantId || connectionsLoading) return;
    setSearch("");
    setRatingFilter("all");
    setCommentFilter("all");
    setReplyFilter("all");
    setReadFilter("all");
    setReadLocal({});
    setSortKey("created_desc");
    setGooglePage(1);
    setGoogleTokenByPage({});
    setGooglePagination(null);
    setGoogleLocationSummary(null);
    setGoogleStatsError(null);
    setGoogleData(null);
    void loadMergedRef.current();
  }, [restaurantId, connectionsLoading, googleConnected, facebookConnected]);

  useEffect(() => {
    if (!restaurantId || connectionsLoading || platformFilter !== "google") {
      return;
    }
    if (!googleConnected) {
      setGoogleData(null);
      setGoogleLoading(false);
      return;
    }
    setGooglePage(1);
    setGoogleTokenByPage({});
    setGooglePagination(null);
    setGoogleLocationSummary(null);
    setGoogleStatsError(null);
    void loadGoogleStats();
    void loadGoogleRef.current({ googlePage: 1, googlePageToken: null });
  }, [
    restaurantId,
    platformFilter,
    googleConnected,
    connectionsLoading,
    loadGoogleStats,
  ]);

  useEffect(() => {
    if (!restaurantId || !platformViewReady) return;
    if (readAllStartedRef.current === restaurantId) return;
    readAllStartedRef.current = restaurantId;
    void markAllReviewsReadClient(restaurantId).then(({ ok }) => {
      if (ok) {
        setReadLocal({});
        setMergedReviews((prev) =>
          prev.map((review) => ({ ...review, isUnread: false })),
        );
        setGoogleData((prev) =>
          prev
            ? {
                ...prev,
                reviews: prev.reviews.map((review) => ({
                  ...review,
                  isUnread: false,
                })),
              }
            : prev,
        );
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
      if (isGooglePaginated) void loadGoogleStats();
    } finally {
      setReplyBusy(false);
    }
  };

  const patchReviewInState = useCallback(
    (review: UnifiedReview, patch: Partial<UnifiedReview>) => {
      const key = `${review.platform}:${review.id}`;
      const apply = (items: UnifiedReview[]) =>
        items.map((item) =>
          `${item.platform}:${item.id}` === key ? { ...item, ...patch } : item,
        );

      if (isGooglePaginated) {
        setGoogleData((prev) =>
          prev ? { ...prev, reviews: apply(prev.reviews) } : prev,
        );
      } else {
        setMergedReviews((prev) => apply(prev));
      }
    },
    [isGooglePaginated],
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
    if (googlePage <= 1 || loading) return;
    const prev = googlePage - 1;
    void loadGoogle({
      googlePage: prev,
      googlePageToken: prev <= 1 ? null : (googleTokenByPage[prev] ?? null),
    });
  };

  const goGoogleNext = () => {
    if (!googlePagination?.nextPageToken || loading) return;
    void loadGoogle({
      googlePage: googlePage + 1,
      googlePageToken: googlePagination.nextPageToken,
    });
  };

  const loadError = useMemo(() => {
    if (platformFilter === "google") {
      return googleData?.loadError ?? null;
    }
    if (platformFilter === REVIEW_FILTER_ALL) {
      return null;
    }
    return mergedLoadErrors[platformFilter] ?? null;
  }, [platformFilter, googleData?.loadError, mergedLoadErrors]);

  const mergedLoadErrorEntries = useMemo(
    () =>
      Object.entries(mergedLoadErrors) as [ReviewPlatform, string][],
    [mergedLoadErrors],
  );

  const hasReviewData = isGooglePaginated
    ? googleData !== null
    : !mergedLoading;

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
      };
    },
    [
      visibilityBusyKey,
      markReviewUnread,
      openReservationDrawer,
      toggleReviewVisibility,
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

  const summaryForCard = useMemo(() => {
    if (isGooglePaginated && !filtersActive && googleLocationSummary) {
      return googleLocationSummary;
    }
    return filteredSummary;
  }, [isGooglePaginated, filtersActive, googleLocationSummary, filteredSummary]);

  if (!ready) {
    return <WorkspaceRestaurantResolvePlaceholder />;
  }
  if (!restaurantId) {
    return <WorkspaceRestaurantMissingMessage />;
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

      {!connectionsLoading && platformFilter === "google" && !googleConnected ? (
        <p className="text-sm text-muted-foreground">
          Google Business ist nicht verbunden. Unter Einstellungen →
          Integrationen verknüpfen, dann erscheinen die Bewertungen hier.
        </p>
      ) : null}

      {!connectionsLoading && platformFilter === "facebook" && !facebookConnected ? (
        <p className="text-sm text-muted-foreground">
          Facebook ist nicht verbunden. Unter Einstellungen → Integrationen
          verknüpfen, dann erscheinen die Empfehlungen hier.
        </p>
      ) : null}

      {platformViewReady ? (
      <div className="space-y-6">
      {platformFilter === "gwada" && !loading && !showSkeleton ? (
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

      {loadError && !loading ? (
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
      !loading ? (
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

      {platformFilter === "google" && googleStatsError && !googleStatsLoading ? (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4 text-sm text-foreground">
            Google-Durchschnitt konnte nicht geladen werden.
            <span className="mt-1 block text-xs text-muted-foreground">
              {googleStatsError}
            </span>
          </CardContent>
        </Card>
      ) : null}

      {loading && !showSkeleton ? (
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
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                <span>
                  {isGooglePaginated && googlePagination
                    ? filtersActive
                      ? `${filteredSortedReviews.length} von ${allReviews.length} auf dieser Seite (Seite ${googlePage}/${googleTotalPages})`
                      : `${allReviews.length} auf dieser Seite · insgesamt ${googleLocationSummary?.count ?? googlePagination.totalReviewCount} bei Google`
                    : filtersActive
                      ? `${filteredSortedReviews.length} von ${allReviews.length} Bewertungen`
                      : `${allReviews.length} Bewertungen`}
                  {isGooglePaginated && filtersActive ? (
                    <span className="mt-0.5 block text-xs">
                      Filter und Sortierung gelten nur für die aktuelle Seite.
                    </span>
                  ) : null}
                </span>
                {filtersActive ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-muted-foreground"
                    onClick={resetFilters}
                  >
                    Filter zurücksetzen
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}

          {allReviews.length === 0 ? (
            <Card className="border-border/50 shadow-card">
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                {platformFilter === REVIEW_FILTER_ALL
                  ? "Noch keine Bewertungen."
                  : "Noch keine Bewertungen auf dieser Plattform."}
              </CardContent>
            </Card>
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
              {viewMode === "list" ? (
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
              {isGooglePaginated && googlePagination ? (
                <ReviewsPagination
                  page={googlePage}
                  totalPages={googleTotalPages}
                  onPrevious={goGooglePrevious}
                  onNext={goGoogleNext}
                  canPrevious={googlePage > 1}
                  canNext={Boolean(googlePagination.nextPageToken)}
                  busy={loading}
                />
              ) : null}
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
