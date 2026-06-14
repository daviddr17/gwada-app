"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Star } from "lucide-react";
import { EmbedAccentRoot } from "@/components/embed/embed-accent-root";
import { EmbedResizeReporter } from "@/components/embed/embed-resize-reporter";
import { ReviewPlatformIcon } from "@/components/reviews/review-platform-icon";
import { ListPaginationSurround } from "@/components/ui/list-pagination";
import { REVIEW_PLATFORM_LABELS } from "@/lib/constants/review-platforms";
import type {
  PublicEmbedReview,
  PublicEmbedReviewsPagination,
} from "@/lib/reviews/public-reviews-server";
import { cn } from "@/lib/utils";

export type EmbedReviewsWidgetProps = {
  restaurantName: string;
  accentHex: string;
  reviews: PublicEmbedReview[];
  summary: {
    count: number;
    average: number | null;
    median: number | null;
    distribution: Record<1 | 2 | 3 | 4 | 5, number>;
  };
  /** Raster (Standard) oder Liste — Einbindung nutzt Raster. */
  viewMode?: "grid" | "list";
  /** Server-Pagination (Embed-Route) — x/y + Seiten unten. */
  pagination?: PublicEmbedReviewsPagination;
};

function StarsDisplay({ rating, size = "md" }: { rating: number; size?: "sm" | "md" }) {
  const full = Math.round(Math.min(5, Math.max(0, rating)));
  return (
    <div className="flex gap-0.5" aria-label={`${rating} von 5 Sternen`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={cn(
            size === "sm" ? "size-3.5" : "size-4",
            i < full
              ? "fill-amber-400 text-amber-400"
              : "text-muted-foreground/30",
          )}
        />
      ))}
    </div>
  );
}

function formatReviewDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function EmbedReviewCard({ review }: { review: PublicEmbedReview }) {
  const date = formatReviewDate(review.createdAt);

  return (
    <article className="mb-4 flex w-full break-inside-avoid flex-col rounded-xl border border-border/50 bg-card p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <ReviewPlatformIcon
            platform={review.platform}
            className="size-4 shrink-0"
            aria-label={REVIEW_PLATFORM_LABELS[review.platform]}
          />
          <StarsDisplay rating={review.rating} size="sm" />
        </div>
        <time
          className="shrink-0 text-xs text-muted-foreground"
          dateTime={review.createdAt}
        >
          {date}
        </time>
      </div>
      {review.authorName ? (
        <p className="mt-2 text-sm font-medium leading-snug">{review.authorName}</p>
      ) : null}
      {review.comment ? (
        <p className="mt-2 line-clamp-4 flex-1 text-sm leading-relaxed text-muted-foreground">
          {review.comment}
        </p>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground/80">Kein Kommentar</p>
      )}
      {review.reply ? (
        <div className="mt-3 rounded-lg border border-border/50 bg-muted/25 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground/80">Antwort: </span>
          <span className="line-clamp-3">{review.reply}</span>
        </div>
      ) : null}
    </article>
  );
}

function EmbedReviewRow({ review }: { review: PublicEmbedReview }) {
  const date = formatReviewDate(review.createdAt);

  return (
    <article className="border-b border-border/40 py-4 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <ReviewPlatformIcon
            platform={review.platform}
            className="size-4 shrink-0"
            aria-label={REVIEW_PLATFORM_LABELS[review.platform]}
          />
          <StarsDisplay rating={review.rating} />
        </div>
        <time
          className="shrink-0 text-xs text-muted-foreground"
          dateTime={review.createdAt}
        >
          {date}
        </time>
      </div>
      {review.authorName ? (
        <p className="mt-2 text-sm font-medium">{review.authorName}</p>
      ) : null}
      {review.comment ? (
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {review.comment}
        </p>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground/80">Kein Kommentar</p>
      )}
      {review.reply ? (
        <div className="mt-3 rounded-lg border border-border/50 bg-muted/25 px-3 py-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground/80">Antwort: </span>
          {review.reply}
        </div>
      ) : null}
    </article>
  );
}

function EmbedReviewsSummary({
  summary,
}: {
  summary: EmbedReviewsWidgetProps["summary"];
}) {
  const maxBar = Math.max(1, ...Object.values(summary.distribution));

  if (summary.count <= 0) return null;

  return (
    <div className="mt-4 grid gap-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-end">
      <div className="flex flex-wrap items-end gap-6">
        <div>
          <p className="text-xs text-muted-foreground">Durchschnitt</p>
          <p className="mt-0.5 flex items-baseline gap-2">
            <span className="text-3xl font-semibold tabular-nums">
              {summary.average?.toLocaleString("de-DE") ?? "—"}
            </span>
            <Star className="size-5 fill-amber-400 text-amber-400" aria-hidden />
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Anzahl</p>
          <p className="mt-0.5 text-3xl font-semibold tabular-nums">
            {summary.count}
          </p>
        </div>
      </div>
      <div className="space-y-1.5 sm:max-w-md sm:justify-self-end">
        {([5, 4, 3, 2, 1] as const).map((stars) => {
          const n = summary.distribution[stars] ?? 0;
          const pct = Math.round((n / maxBar) * 100);
          return (
            <div key={stars} className="flex items-center gap-2 text-sm">
              <span className="w-8 shrink-0 text-muted-foreground">{stars}★</span>
              <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-accent/80"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-8 shrink-0 text-right text-muted-foreground">
                {n}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function EmbedReviewsWidget({
  restaurantName,
  accentHex,
  reviews,
  summary,
  viewMode = "grid",
  pagination,
}: EmbedReviewsWidgetProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [navigating, startTransition] = useTransition();
  const paginated = pagination != null;

  const pushPage = useCallback(
    (page: number) => {
      const params = new URLSearchParams(searchParams.toString());
      if (page <= 1) params.delete("page");
      else params.set("page", String(page));
      const nextQs = params.toString();
      const currentQs = searchParams.toString();
      if (nextQs === currentQs) return;

      startTransition(() => {
        router.push(nextQs ? `${pathname}?${nextQs}` : pathname, {
          scroll: false,
        });
      });
    },
    [router, pathname, searchParams],
  );

  useEffect(() => {
    if (!paginated) return;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [paginated, pagination?.page]);

  const resizeDeps = useMemo(
    () => [
      restaurantName,
      viewMode,
      reviews.length,
      pagination?.page ?? 1,
      pagination?.totalCount ?? reviews.length,
      summary.count,
      summary.average,
      summary.median,
      summary.distribution[1],
      summary.distribution[2],
      summary.distribution[3],
      summary.distribution[4],
      summary.distribution[5],
      reviews
        .map(
          (r) =>
            `${r.id}:${r.rating}:${r.comment?.length ?? 0}:${r.authorName ?? ""}`,
        )
        .join("|"),
    ],
    [restaurantName, viewMode, reviews, pagination, summary],
  );

  const showPagination =
    paginated &&
    pagination != null &&
    (pagination.totalPages > 1 || pagination.totalCount > 0);

  const reviewList =
    viewMode === "list" ? (
      <div>
        {reviews.map((review) => (
          <EmbedReviewRow
            key={`${review.platform}-${review.id}`}
            review={review}
          />
        ))}
      </div>
    ) : (
      <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 [contain:layout]">
        {reviews.map((review) => (
          <EmbedReviewCard
            key={`${review.platform}-${review.id}`}
            review={review}
          />
        ))}
      </div>
    );

  return (
    <EmbedAccentRoot accentHex={accentHex}>
      <EmbedResizeReporter deps={resizeDeps} widget="reviews" />
      <div className="w-full min-w-0 px-4 py-5 sm:px-6">
        <header className="border-b border-border/40 pb-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Bewertungen
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">
            {restaurantName}
          </h1>
          <EmbedReviewsSummary summary={summary} />
        </header>

        <section className="mt-5">
          {reviews.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Noch keine Bewertungen — Gäste können nach dem Besuch über Gwada
              bewerten.
            </p>
          ) : showPagination && pagination ? (
            <ListPaginationSurround
              classNameAbove="mb-4 border-b-0 pb-0"
              classNameBelow="mt-4 border-t-0 pt-0"
              page={pagination.page}
              totalPages={pagination.totalPages}
              shown={reviews.length}
              totalCount={pagination.totalCount}
              itemLabel="Bewertungen"
              canPrevious={pagination.page > 1}
              canNext={pagination.page < pagination.totalPages}
              busy={navigating}
              onPrevious={() => pushPage(pagination.page - 1)}
              onNext={() => pushPage(pagination.page + 1)}
            >
              {reviewList}
            </ListPaginationSurround>
          ) : (
            reviewList
          )}
        </section>

        <p className="mt-6 text-center text-[11px] text-muted-foreground/80">
          Bewertungen über Gwada und verbundene Plattformen
        </p>
      </div>
    </EmbedAccentRoot>
  );
}
