"use client";

import { Fragment } from "react";
import {
  CalendarDays,
  Eye,
  EyeOff,
  Pin,
  PinOff,
  ScrollText,
  Share2,
  Star,
} from "lucide-react";
import { ReviewCommentExpandable } from "@/components/reviews/review-comment-expandable";
import { ReviewPlatformIcon } from "@/components/reviews/review-platform-icon";
import { FeedPinnedBadge } from "@/components/feed-pin/feed-pinned-badge";
import { feedTimelineDateChipClassName } from "@/components/feed/feed-timeline-date-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { REVIEW_PLATFORM_LABELS } from "@/lib/constants/review-platforms";
import type { UnifiedReview } from "@/lib/reviews/unified-review";
import { feedPinnedItemSurfaceClassName } from "@/lib/ui/feed-pin-styles";
import { formatReviewCommentDisplay } from "@/lib/reviews/format-review-comment";
import {
  formatReviewTimelineDay,
  formatReviewTimelineMonthShort,
  formatReviewTimelineMonthYear,
  formatReviewTimelineTimeLabel,
  reviewTimelineSameMonthYear,
} from "@/lib/reviews/format-reviews-timeline-date";
import { cn } from "@/lib/utils";

function StarsDisplay({ rating }: { rating: number }) {
  const full = Math.round(Math.min(5, Math.max(0, rating)));
  return (
    <div className="flex shrink-0 gap-0.5" aria-label={`${rating} von 5 Sternen`}>
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

export type ReviewCardActions = {
  review: UnifiedReview;
  isUnread?: boolean;
  showPlatform?: boolean;
  variant?: "grid" | "list" | "timeline";
  visibilityBusy?: boolean;
  onReply?: () => void;
  onProtocol?: () => void;
  onOpenContact?: () => void;
  onOpenReservation?: () => void;
  onToggleHidden?: () => void;
  onTogglePin?: () => void;
  onShare?: () => void;
  pinBusy?: boolean;
};

function ReviewActionsRow({
  review,
  onReply,
  onProtocol,
  onOpenContact,
  onOpenReservation,
  onToggleHidden,
  onTogglePin,
  onShare,
  pinBusy,
  visibilityBusy,
}: Pick<
  ReviewCardActions,
  | "review"
  | "onReply"
  | "onProtocol"
  | "onOpenContact"
  | "onOpenReservation"
  | "onToggleHidden"
  | "onTogglePin"
  | "onShare"
  | "pinBusy"
  | "visibilityBusy"
>) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {review.reservationId && onOpenReservation ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={onOpenReservation}
        >
          <CalendarDays className="size-3.5" />
          Reservierung
          {review.reservationNumber ? ` #${review.reservationNumber}` : ""}
        </Button>
      ) : null}
      {review.contactId && onOpenContact ? (
        <Button type="button" variant="outline" size="sm" onClick={onOpenContact}>
          Kontakt
        </Button>
      ) : null}
      {review.canReply && onReply ? (
        <Button type="button" variant="outline" size="sm" onClick={onReply}>
          Antworten
        </Button>
      ) : null}
      {onShare ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={onShare}
        >
          <Share2 className="size-3.5" />
          Teilen
        </Button>
      ) : null}
      {onTogglePin ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground"
          disabled={pinBusy}
          onClick={onTogglePin}
        >
          {review.isPinned ? (
            <>
              <PinOff className="size-3.5" />
              Pin lösen
            </>
          ) : (
            <>
              <Pin className="size-3.5" />
              Anpinnen
            </>
          )}
        </Button>
      ) : null}
      {onToggleHidden ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground"
          disabled={visibilityBusy}
          onClick={onToggleHidden}
        >
          {review.hiddenFromPublic ? (
            <>
              <Eye className="size-3.5" />
              Auf Profil zeigen
            </>
          ) : (
            <>
              <EyeOff className="size-3.5" />
              Auf Profil ausblenden
            </>
          )}
        </Button>
      ) : null}
      {onProtocol ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground"
          onClick={onProtocol}
        >
          <ScrollText className="size-3.5" />
          Protokoll
        </Button>
      ) : null}
    </div>
  );
}

function ReviewAuthor({
  review,
  isUnread,
  onOpenContact,
}: {
  review: UnifiedReview;
  isUnread: boolean;
  onOpenContact?: () => void;
}) {
  if (!review.authorName) return null;
  if (review.contactId && onOpenContact) {
    return (
      <button
        type="button"
        className="min-w-0 text-left text-sm font-medium text-foreground underline-offset-4 hover:underline"
        onClick={onOpenContact}
      >
        {review.authorName}
      </button>
    );
  }
  return (
    <p className={cn("min-w-0 text-sm font-medium", isUnread && "font-semibold")}>
      {review.authorName}
    </p>
  );
}

const timelineRowSurfaceClassName =
  "min-w-0 flex-1 rounded-xl border border-border/50 bg-card p-3.5 text-left shadow-card transition sm:p-4";

function ReviewTimelineRow({
  review,
  isUnread = false,
  showPlatform = false,
  showConnectorBelow,
  visibilityBusy = false,
  onReply,
  onProtocol,
  onOpenContact,
  onOpenReservation,
  onToggleHidden,
  onTogglePin,
  onShare,
  pinBusy,
}: ReviewCardActions & { showConnectorBelow: boolean }) {
  const timeLabel = formatReviewTimelineTimeLabel(review.createdAt);

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

      <div
        className={cn(
          timelineRowSurfaceClassName,
          isUnread && "border-accent/35 bg-accent/[0.03]",
          review.hiddenFromPublic && "opacity-80",
          review.isPinned && feedPinnedItemSurfaceClassName,
        )}
      >
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              {showPlatform || isUnread ? (
                <Badge variant="secondary" className="gap-1.5">
                  <ReviewPlatformIcon
                    platform={review.platform}
                    className="size-3"
                    aria-label={
                      isUnread
                        ? `${REVIEW_PLATFORM_LABELS[review.platform]}, ungelesen`
                        : REVIEW_PLATFORM_LABELS[review.platform]
                    }
                  />
                  {REVIEW_PLATFORM_LABELS[review.platform]}
                </Badge>
              ) : null}
              <StarsDisplay rating={review.rating} />
              {review.hiddenFromPublic ? (
                <Badge variant="secondary" className="text-[10px]">
                  Ausgeblendet
                </Badge>
              ) : null}
              {review.isPinned ? <FeedPinnedBadge /> : null}
            </div>
            <time
              className="shrink-0 text-xs text-muted-foreground tabular-nums"
              dateTime={review.createdAt}
            >
              {timeLabel}
            </time>
          </div>

          <ReviewAuthor
            review={review}
            isUnread={isUnread}
            onOpenContact={onOpenContact}
          />

          <ReviewCommentExpandable
            text={formatReviewCommentDisplay(review.comment)}
          />

          {review.reply ? (
            <div className="rounded-lg border border-border/50 bg-muted/30 px-3 py-2 text-sm">
              <span className="font-medium text-muted-foreground">Antwort: </span>
              {review.reply}
            </div>
          ) : null}

          <ReviewActionsRow
            review={review}
            onReply={onReply}
            onProtocol={onProtocol}
            onOpenContact={onOpenContact}
            onOpenReservation={onOpenReservation}
            onToggleHidden={onToggleHidden}
            onTogglePin={onTogglePin}
            onShare={onShare}
            pinBusy={pinBusy}
            visibilityBusy={visibilityBusy}
          />
        </div>
      </div>
    </article>
  );
}

/** Kompakte Listen-Karte (Ansicht „Liste“). */
export function ReviewCard({
  review,
  isUnread = false,
  showPlatform = false,
  visibilityBusy = false,
  onReply,
  onProtocol,
  onOpenContact,
  onOpenReservation,
  onToggleHidden,
  onTogglePin,
  onShare,
  pinBusy,
}: ReviewCardActions) {
  const date = formatReviewTimelineTimeLabel(review.createdAt);

  return (
    <Card
      className={cn(
        "border-border/50 shadow-card",
        isUnread && "border-accent/35 bg-accent/[0.03]",
        review.hiddenFromPublic && "opacity-80",
        review.isPinned && feedPinnedItemSurfaceClassName,
      )}
    >
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {showPlatform || isUnread ? (
              <ReviewPlatformIcon
                platform={review.platform}
                className="size-4 shrink-0"
                aria-label={REVIEW_PLATFORM_LABELS[review.platform]}
              />
            ) : null}
            <StarsDisplay rating={review.rating} />
            {review.hiddenFromPublic ? (
              <Badge variant="secondary" className="text-[10px]">
                Ausgeblendet
              </Badge>
            ) : null}
            {review.isPinned ? <FeedPinnedBadge /> : null}
            <span className="text-xs text-muted-foreground">{date}</span>
          </div>
          <ReviewAuthor
            review={review}
            isUnread={isUnread}
            onOpenContact={onOpenContact}
          />
          <ReviewCommentExpandable
            text={formatReviewCommentDisplay(review.comment)}
          />
          {review.reply ? (
            <div className="rounded-lg border border-border/50 bg-muted/30 px-3 py-2 text-sm">
              <span className="font-medium text-muted-foreground">Antwort: </span>
              {review.reply}
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
          {onProtocol ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="size-8 self-end rounded-md text-muted-foreground"
              aria-label="Bewertungsprotokoll"
              onClick={onProtocol}
            >
              <ScrollText className="size-4" />
            </Button>
          ) : null}
          <ReviewActionsRow
            review={review}
            onReply={onReply}
            onOpenContact={onOpenContact}
            onOpenReservation={onOpenReservation}
            onToggleHidden={onToggleHidden}
            onTogglePin={onTogglePin}
            onShare={onShare}
            pinBusy={pinBusy}
            visibilityBusy={visibilityBusy}
          />
        </div>
      </CardContent>
    </Card>
  );
}

/** Gästebuch-Timeline — Standardansicht (Dashboard „Kacheln“/Grid). */
export function ReviewsTimelineView({
  reviews,
  showPlatform,
  getReviewProps,
}: {
  reviews: UnifiedReview[];
  showPlatform: boolean;
  getReviewProps: (
    review: UnifiedReview,
  ) => Omit<ReviewCardActions, "review" | "showPlatform" | "variant">;
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
              <ReviewTimelineRow
                review={review}
                showPlatform={showPlatform}
                showConnectorBelow={index < reviews.length - 1}
                {...getReviewProps(review)}
              />
            </li>
          </Fragment>
        );
      })}
    </ul>
  );
}

/** @deprecated Alias — Dashboard nutzt die Timeline. */
export function ReviewsGridView(props: {
  reviews: UnifiedReview[];
  showPlatform: boolean;
  getReviewProps: (
    review: UnifiedReview,
  ) => Omit<ReviewCardActions, "review" | "showPlatform" | "variant">;
}) {
  return <ReviewsTimelineView {...props} />;
}

export function ReviewsListView({
  reviews,
  showPlatform,
  getReviewProps,
}: {
  reviews: UnifiedReview[];
  showPlatform: boolean;
  getReviewProps: (
    review: UnifiedReview,
  ) => Omit<ReviewCardActions, "review" | "showPlatform" | "variant">;
}) {
  return (
    <div className="space-y-3">
      {reviews.map((review) => (
        <ReviewCard
          key={`${review.platform}:${review.id}`}
          review={review}
          showPlatform={showPlatform}
          variant="list"
          {...getReviewProps(review)}
        />
      ))}
    </div>
  );
}
