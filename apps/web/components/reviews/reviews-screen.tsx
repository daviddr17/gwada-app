"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Link2, ScrollText, Search, Star } from "lucide-react";
import { ReviewPlatformChip } from "@/components/reviews/review-platform-chip";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { GwadaReviewProtocolDrawer } from "@/components/reviews/gwada-review-protocol-drawer";
import { ReviewInvitationSheet } from "@/components/reviews/review-invitation-sheet";
import { ReviewSummaryCard } from "@/components/reviews/review-summary-card";
import { ReviewsPagination } from "@/components/reviews/reviews-pagination";
import { settingsAccentSaveButtonClassName } from "@/components/settings/settings-sticky-save-bar";
import {
  isReviewPlatform,
  REVIEW_PLATFORM_ORDER,
  type ReviewPlatform,
} from "@/lib/constants/review-platforms";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useReviewPlatformConnections } from "@/lib/hooks/use-review-platform-connections";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import type { UnifiedReview } from "@/lib/reviews/unified-review";
import {
  filterReviews,
  hasActiveReviewFilters,
  REVIEW_COMMENT_FILTER_OPTIONS,
  REVIEW_RATING_FILTER_OPTIONS,
  REVIEW_REPLY_FILTER_OPTIONS,
  REVIEW_SORT_OPTIONS,
  reviewSortOptionLabel,
  sortReviews,
  type ReviewCommentFilter,
  type ReviewRatingFilter,
  type ReviewReplyFilter,
  type ReviewSortKey,
} from "@/lib/reviews/filter-sort-reviews";
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
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import { modulePrimaryAddButtonClassName } from "@/lib/ui/module-primary-add-button";
import { cn } from "@/lib/utils";

const reviewsSortSelectClass = appSelectTriggerAccentCn(
  "h-9 w-full min-w-[11rem] [&_[data-slot=select-value]]:truncate",
);

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

function StarsDisplay({ rating }: { rating: number }) {
  const full = Math.round(Math.min(5, Math.max(0, rating)));
  return (
    <div className="flex gap-0.5" aria-label={`${rating} von 5 Sternen`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={cn(
            "size-4",
            i < full
              ? "fill-amber-400 text-amber-400"
              : "text-muted-foreground/30",
          )}
        />
      ))}
    </div>
  );
}

function ReviewCard({
  review,
  onReply,
  onProtocol,
  onOpenContact,
}: {
  review: UnifiedReview;
  onReply?: () => void;
  onProtocol?: () => void;
  onOpenContact?: () => void;
}) {
  const date = new Date(review.createdAt).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <Card className="border-border/50 shadow-card">
      <CardHeader className="space-y-2 pb-2">
        <div className="flex items-start justify-between gap-2">
          <StarsDisplay rating={review.rating} />
          <div className="flex shrink-0 items-center gap-1">
            <span className="text-xs text-muted-foreground">{date}</span>
            {onProtocol ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="size-6 shrink-0 rounded-md text-muted-foreground hover:bg-muted/50 hover:text-muted-foreground"
                aria-label="Bewertungsprotokoll"
                onClick={onProtocol}
              >
                <ScrollText className="size-3" />
              </Button>
            ) : null}
          </div>
        </div>
        {review.authorName ? (
          review.contactId && onOpenContact ? (
            <button
              type="button"
              className="text-left text-sm font-medium text-foreground underline-offset-4 hover:underline"
              onClick={onOpenContact}
            >
              {review.authorName}
            </button>
          ) : (
            <p className="text-sm font-medium">{review.authorName}</p>
          )
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {review.comment ? (
          <p className="text-sm leading-relaxed text-foreground">{review.comment}</p>
        ) : (
          <p className="text-sm text-muted-foreground">Kein Kommentar</p>
        )}
        {review.reply ? (
          <div className="rounded-lg border border-border/50 bg-muted/30 px-3 py-2 text-sm">
            <span className="font-medium text-muted-foreground">Antwort: </span>
            {review.reply}
          </div>
        ) : null}
        {review.canReply && onReply ? (
          <Button type="button" variant="outline" size="sm" onClick={onReply}>
            Antworten
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ReviewsGridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }, (_, i) => (
        <Card key={i} className="border-border/50 shadow-card">
          <CardContent className="space-y-3 p-6">
            <div className="skeleton-shimmer h-4 w-24 rounded" />
            <div className="skeleton-shimmer h-3 w-full rounded" />
            <div className="skeleton-shimmer h-3 w-4/5 rounded" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function resolveReviewsPlatform(
  platformParam: string | null,
): ReviewPlatform {
  if (platformParam && isReviewPlatform(platformParam)) {
    return platformParam;
  }
  return "gwada";
}

export function ReviewsScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const platformParam = searchParams.get("platform");
  const { restaurantId, ready } = useWorkspaceRestaurantUuid();
  const {
    loading: connectionsLoading,
    googleConnected,
    facebookConnected,
  } = useReviewPlatformConnections(restaurantId);
  const [platform, setPlatform] = useState<ReviewPlatform>(() =>
    resolveReviewsPlatform(platformParam),
  );
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReviewsApiResponse | null>(null);
  const [replyTarget, setReplyTarget] = useState<UnifiedReview | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyBusy, setReplyBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [ratingFilter, setRatingFilter] = useState<ReviewRatingFilter>("all");
  const [commentFilter, setCommentFilter] =
    useState<ReviewCommentFilter>("all");
  const [replyFilter, setReplyFilter] = useState<ReviewReplyFilter>("all");
  const [sortKey, setSortKey] = useState<ReviewSortKey>("created_desc");
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
  const [protocolReview, setProtocolReview] = useState<UnifiedReview | null>(null);
  const [overviewProtocolOpen, setOverviewProtocolOpen] = useState(false);
  const [contactDrawerOpen, setContactDrawerOpen] = useState(false);
  const [contactDrawerId, setContactDrawerId] = useState<string | null>(null);
  const { getProfileForRestaurantId, isReady: profileReady } =
    useRestaurantProfile();
  const showSkeleton = useDeferredSkeleton(loading);

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

  const showReplyFilter = platform === "google" || platform === "facebook";
  const isGooglePaginated = platform === "google";

  const isPlatformAvailable = useCallback(
    (p: ReviewPlatform): boolean => {
      if (p === "gwada") return true;
      if (p === "google") return googleConnected;
      if (p === "facebook") return facebookConnected;
      return false;
    },
    [googleConnected, facebookConnected],
  );

  const platformReady = isPlatformAvailable(platform);

  const reviewProtocolParam = searchParams.get("reviewProtocol")?.trim() ?? "";

  useEffect(() => {
    if (!reviewProtocolParam || platform !== "gwada" || !ready) return;
    const match = data?.reviews.find((r) => r.id === reviewProtocolParam);
    if (match) {
      setProtocolReview(match);
    }
  }, [reviewProtocolParam, platform, ready, data?.reviews]);

  useEffect(() => {
    if (connectionsLoading || !ready || !restaurantId) return;

    const requested = resolveReviewsPlatform(platformParam);
    let resolved = requested;
    if (!isPlatformAvailable(requested)) {
      resolved =
        REVIEW_PLATFORM_ORDER.find((p) => isPlatformAvailable(p)) ?? "gwada";
    }

    setPlatform((prev) => (prev === resolved ? prev : resolved));

    if (platformParam !== resolved) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("platform", resolved);
      router.replace(`/bewertungen/uebersicht?${params.toString()}`);
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

  const selectPlatform = (p: ReviewPlatform) => {
    if (!isPlatformAvailable(p)) return;
    setPlatform(p);
    const params = new URLSearchParams(searchParams.toString());
    params.set("platform", p);
    router.replace(`/bewertungen/uebersicht?${params.toString()}`);
  };

  const load = useCallback(
    async (opts?: { googlePage?: number; googlePageToken?: string | null }) => {
      if (!restaurantId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const params = new URLSearchParams({ restaurantId, platform });
        if (isGooglePaginated) {
          const page = opts?.googlePage ?? 1;
          const token =
            opts?.googlePageToken !== undefined
              ? opts.googlePageToken
              : page <= 1
                ? null
                : (googleTokenByPage[page] ?? null);
          if (token) params.set("googlePageToken", token);
        }

        const res = await fetch(`/api/reviews?${params}`);
        const json = (await res.json()) as ReviewsApiResponse & { error?: string };
        if (!res.ok) {
          toast.error(json.error ?? "Bewertungen konnten nicht geladen werden.");
          setData(null);
          return;
        }
        setData(json);

        if (isGooglePaginated && json.googlePagination) {
          const page = opts?.googlePage ?? 1;
          setGooglePage(page);
          setGooglePagination(json.googlePagination);
          const next = json.googlePagination.nextPageToken;
          if (next) {
            setGoogleTokenByPage((prev) => ({ ...prev, [page + 1]: next }));
          }
        }
      } catch {
        toast.error("Netzwerkfehler beim Laden der Bewertungen.");
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [restaurantId, platform, isGooglePaginated, googleTokenByPage],
  );

  const loadRef = useRef(load);
  loadRef.current = load;

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
    if (!isGooglePaginated) {
      void load();
      return;
    }
    void load({
      googlePage,
      googlePageToken:
        googlePage <= 1 ? null : (googleTokenByPage[googlePage] ?? null),
    });
  }, [load, isGooglePaginated, googlePage, googleTokenByPage]);

  useEffect(() => {
    if (!restaurantId || connectionsLoading || !platformReady) {
      if (!platformReady) {
        setData(null);
        setLoading(false);
      }
      return;
    }
    setGooglePage(1);
    setGoogleTokenByPage({});
    setGooglePagination(null);
    setGoogleLocationSummary(null);
    setGoogleStatsError(null);
    setSearch("");
    setRatingFilter("all");
    setCommentFilter("all");
    setReplyFilter("all");
    setSortKey("created_desc");
    if (platform === "google") {
      void loadGoogleStats();
    }
    void loadRef.current({ googlePage: 1, googlePageToken: null });
  }, [
    restaurantId,
    platform,
    loadGoogleStats,
    connectionsLoading,
    platformReady,
  ]);

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

  const googleTotalPages = googlePagination
    ? googleReviewsTotalPages(googlePagination.totalReviewCount)
    : 1;

  const goGooglePrevious = () => {
    if (googlePage <= 1 || loading) return;
    const prev = googlePage - 1;
    void load({
      googlePage: prev,
      googlePageToken: prev <= 1 ? null : (googleTokenByPage[prev] ?? null),
    });
  };

  const goGoogleNext = () => {
    if (!googlePagination?.nextPageToken || loading) return;
    void load({
      googlePage: googlePage + 1,
      googlePageToken: googlePagination.nextPageToken,
    });
  };

  const loadError = data?.loadError;
  const allReviews = data?.reviews ?? [];

  const filteredSortedReviews = useMemo(() => {
    const filtered = filterReviews(allReviews, {
      search,
      ratingFilter,
      commentFilter,
      replyFilter,
      showReplyFilter,
    });
    return sortReviews(filtered, sortKey);
  }, [
    allReviews,
    search,
    ratingFilter,
    commentFilter,
    replyFilter,
    showReplyFilter,
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

  const filtersActive = hasActiveReviewFilters({
    search,
    ratingFilter,
    commentFilter,
    replyFilter,
    showReplyFilter,
  });

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
    setSortKey("created_desc");
  };

  return (
    <div className="flex w-full min-w-0 flex-col gap-4 pt-2">
      <div className="flex flex-wrap gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {REVIEW_PLATFORM_ORDER.map((p) => (
          <ReviewPlatformChip
            key={p}
            platform={p}
            selected={platform === p}
            onSelect={() => selectPlatform(p)}
            disabled={connectionsLoading || !isPlatformAvailable(p)}
          />
        ))}
      </div>

      {!connectionsLoading && platform === "google" && !googleConnected ? (
        <p className="text-sm text-muted-foreground">
          Google Business ist nicht verbunden. Unter Einstellungen →
          Integrationen verknüpfen, dann erscheinen die Bewertungen hier.
        </p>
      ) : null}

      {!connectionsLoading && platform === "facebook" && !facebookConnected ? (
        <p className="text-sm text-muted-foreground">
          Facebook ist nicht verbunden. Unter Einstellungen → Integrationen
          verknüpfen, dann erscheinen die Empfehlungen hier.
        </p>
      ) : null}

      {platformReady ? (
      <div className="space-y-6">
      {platform === "gwada" ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <p className="max-w-2xl text-sm text-muted-foreground">
            Gwada-Bewertungen können je nach Einstellung automatisch nach
            Reservierungen angefragt werden — oder du erstellst und versendest
            hier manuell Einladungslinks (24 Stunden gültig). Automatik und Kanäle
            unter{" "}
            <a
              href="/reservierungen/einstellungen"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Reservierungen → Einstellungen
            </a>
            .
          </p>
          <div className="flex shrink-0 items-center gap-2 self-start">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-11 rounded-xl"
              aria-label="Gesamtprotokoll Bewertungen"
              onClick={() => setOverviewProtocolOpen(true)}
            >
              <ScrollText className="size-4" />
            </Button>
            <Button
              type="button"
              size="lg"
              className={modulePrimaryAddButtonClassName}
              onClick={() => setInviteSheetOpen(true)}
            >
              <Link2 className="size-4" />
              Bewertungslink erstellen
            </Button>
          </div>
        </div>
      ) : null}

      {loadError && !loading ? (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 text-sm text-destructive">
            {platform === "google"
              ? "Google-Bewertungen konnten nicht geladen werden. Prüfe die Verbindung unter Einstellungen → Integrationen."
              : "Facebook-Empfehlungen konnten nicht geladen werden. Meta stellt Page-Ratings regional unterschiedlich bereit — Verbindung und Berechtigungen prüfen."}
            <span className="mt-1 block text-xs opacity-80">{loadError}</span>
          </CardContent>
        </Card>
      ) : null}

      {platform === "google" && googleStatsError && !googleStatsLoading ? (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4 text-sm text-foreground">
            Google-Durchschnitt konnte nicht geladen werden.
            <span className="mt-1 block text-xs text-muted-foreground">
              {googleStatsError}
            </span>
          </CardContent>
        </Card>
      ) : null}

      {showSkeleton ? (
        <>
          <div className="skeleton-shimmer h-28 rounded-2xl" />
          <ReviewsGridSkeleton />
        </>
      ) : data ? (
        <>
          <ReviewSummaryCard summary={summaryForCard} />

          {allReviews.length > 0 ? (
            <div className="space-y-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Kommentar, Name oder Antwort …"
                    className="h-11 rounded-2xl border-border/50 bg-card pl-10 shadow-none dark:shadow-sm"
                    aria-label="Bewertungen durchsuchen"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <SearchableSelect
                    options={REVIEW_RATING_FILTER_OPTIONS}
                    value={ratingFilter}
                    onValueChange={(v) =>
                      setRatingFilter(v as ReviewRatingFilter)
                    }
                    placeholder="Sterne"
                    searchPlaceholder="Sterne …"
                    aria-label="Nach Sternen filtern"
                    className="w-full sm:w-[10.5rem]"
                  />
                  <SearchableSelect
                    options={REVIEW_COMMENT_FILTER_OPTIONS}
                    value={commentFilter}
                    onValueChange={(v) =>
                      setCommentFilter(v as ReviewCommentFilter)
                    }
                    placeholder="Kommentar"
                    searchPlaceholder="Kommentar …"
                    aria-label="Nach Kommentar filtern"
                    className="w-full sm:w-[11.5rem]"
                  />
                  {showReplyFilter ? (
                    <SearchableSelect
                      options={REVIEW_REPLY_FILTER_OPTIONS}
                      value={replyFilter}
                      onValueChange={(v) =>
                        setReplyFilter(v as ReviewReplyFilter)
                      }
                      placeholder="Antwort"
                      searchPlaceholder="Antwort …"
                      aria-label="Nach Antwortstatus filtern"
                      className="w-full sm:w-[11.5rem]"
                    />
                  ) : null}
                  <Select
                    value={sortKey}
                    onValueChange={(v) => setSortKey(v as ReviewSortKey)}
                  >
                    <SelectTrigger
                      className={reviewsSortSelectClass}
                      aria-label="Sortierung"
                    >
                      <SelectValue placeholder="Sortieren">
                        {reviewSortOptionLabel(sortKey)}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {REVIEW_SORT_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                Noch keine Bewertungen auf dieser Plattform.
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
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filteredSortedReviews.map((review) => (
                  <ReviewCard
                    key={review.id}
                    review={review}
                    onProtocol={
                      platform === "gwada"
                        ? () => setProtocolReview(review)
                        : undefined
                    }
                    onOpenContact={
                      review.contactId
                        ? () => {
                            setContactDrawerId(review.contactId!);
                            setContactDrawerOpen(true);
                          }
                        : undefined
                    }
                    onReply={
                      review.canReply
                        ? () => {
                            setReplyTarget(review);
                            setReplyText(review.reply ?? "");
                          }
                        : undefined
                    }
                  />
                ))}
              </div>
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
              Deine Antwort wird bei {platform === "google" ? "Google" : "Facebook"}{" "}
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
                  ? `/bewertungen/uebersicht?${q}`
                  : "/bewertungen/uebersicht?platform=gwada",
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
      </div>
      ) : null}
    </div>
  );
}
