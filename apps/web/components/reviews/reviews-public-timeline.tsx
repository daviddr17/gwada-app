"use client";

import { Fragment } from "react";
import { Star } from "lucide-react";
import { ReviewCommentExpandable } from "@/components/reviews/review-comment-expandable";
import { ReviewPlatformIcon } from "@/components/reviews/review-platform-icon";
import { feedTimelineDateChipClassName } from "@/components/feed/feed-timeline-date-skeleton";
import { Badge } from "@/components/ui/badge";
import { REVIEW_PLATFORM_LABELS } from "@/lib/constants/review-platforms";
import type { PublicEmbedReview } from "@/lib/reviews/public-reviews-server";
import {
  formatReviewTimelineDay,
  formatReviewTimelineMonthShort,
  formatReviewTimelineMonthYear,
  formatReviewTimelineTimeLabel,
  reviewTimelineSameMonthYear,
} from "@/lib/reviews/format-reviews-timeline-date";
import { cn } from "@/lib/utils";

const timelineRowSurfaceClassName =
  "relative min-w-0 flex-1 overflow-hidden rounded-xl border border-border/50 bg-card p-3.5 text-left shadow-card transition sm:p-4";

function StarsDisplay({
  rating,
  size = "md",
}: {
  rating: number;
  size?: "sm" | "md";
}) {
  const full = Math.round(Math.min(5, Math.max(0, rating)));
  return (
    <div
      className="flex shrink-0 gap-0.5"
      aria-label={`${rating} von 5 Sternen`}
    >
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

function PublicReviewTimelineRow({
  review,
  showConnectorBelow,
  locale = "de-DE",
  emptyCommentLabel,
  moreLabel,
  lessLabel,
  replyLabel = "Antwort:",
}: {
  review: PublicEmbedReview;
  showConnectorBelow: boolean;
  locale?: string;
  emptyCommentLabel?: string;
  moreLabel?: string;
  lessLabel?: string;
  replyLabel?: string;
}) {
  const timeLabel = formatReviewTimelineTimeLabel(review.createdAt, locale);

  return (
    <article className="flex w-full gap-3 sm:gap-4">
      <div className="relative flex w-14 shrink-0 flex-col items-center self-stretch sm:w-16">
        <div className={feedTimelineDateChipClassName}>
          <span className="text-xl font-semibold tabular-nums leading-none sm:text-2xl">
            {formatReviewTimelineDay(review.createdAt)}
          </span>
          <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {formatReviewTimelineMonthShort(review.createdAt)}
          </span>
        </div>
        {showConnectorBelow ? (
          <div
            className="mt-1 w-px min-h-3 flex-1 bg-border/60"
            aria-hidden
          />
        ) : null}
      </div>

      <div className={timelineRowSurfaceClassName}>
        <span
          className="pointer-events-none absolute -left-0.5 top-1 select-none font-serif text-5xl leading-none text-accent/25"
          aria-hidden
        >
          “
        </span>
        <div className="relative space-y-2 pl-3 sm:pl-4">
          <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <Badge variant="secondary" className="gap-1.5">
                <ReviewPlatformIcon
                  platform={review.platform}
                  className="size-3"
                />
                {REVIEW_PLATFORM_LABELS[review.platform]}
              </Badge>
              <StarsDisplay rating={review.rating} size="sm" />
            </div>
            <time
              className="shrink-0 text-xs text-muted-foreground tabular-nums"
              dateTime={review.createdAt}
            >
              {timeLabel}
            </time>
          </div>
          {review.authorName ? (
            <p className="text-sm font-medium leading-snug">{review.authorName}</p>
          ) : null}
          <div data-embed-mt>
            <ReviewCommentExpandable
              text={review.comment}
              emptyLabel={emptyCommentLabel}
              moreLabel={moreLabel}
              lessLabel={lessLabel}
              textClassName="text-muted-foreground"
            />
          </div>
          {review.reply ? (
            <div className="rounded-lg border border-border/50 bg-muted/25 px-3 py-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground/80">{replyLabel} </span>
              <span data-embed-mt>{review.reply}</span>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function PublicReviewsTimelineView({
  reviews,
  locale = "de-DE",
  emptyCommentLabel,
  moreLabel,
  lessLabel,
  replyLabel,
}: {
  reviews: PublicEmbedReview[];
  locale?: string;
  emptyCommentLabel?: string;
  moreLabel?: string;
  lessLabel?: string;
  replyLabel?: string;
}) {
  return (
    <ul className="space-y-0">
      {reviews.map((review, index) => {
        const previous = reviews[index - 1];
        const showMonthHeader =
          !previous ||
          !reviewTimelineSameMonthYear(previous.createdAt, review.createdAt);

        return (
          <Fragment key={`${review.platform}:${review.id}`}>
            {showMonthHeader ? (
              <li
                className={cn(
                  "pb-2",
                  index === 0 ? "pt-0" : "border-t border-border/40 pt-4",
                )}
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {formatReviewTimelineMonthYear(review.createdAt)}
                </p>
              </li>
            ) : null}
            <li className="pb-3 last:pb-0">
              <PublicReviewTimelineRow
                review={review}
                showConnectorBelow={index < reviews.length - 1}
                locale={locale}
                emptyCommentLabel={emptyCommentLabel}
                moreLabel={moreLabel}
                lessLabel={lessLabel}
                replyLabel={replyLabel}
              />
            </li>
          </Fragment>
        );
      })}
    </ul>
  );
}
