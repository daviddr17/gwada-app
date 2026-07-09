"use client";

import { CalendarDays, Eye, EyeOff, Pin, PinOff, ScrollText, Share2, Star } from "lucide-react";
import { ReviewPlatformIcon } from "@/components/reviews/review-platform-icon";
import { FeedPinnedBadge } from "@/components/feed-pin/feed-pinned-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  REVIEW_PLATFORM_LABELS,
} from "@/lib/constants/review-platforms";
import type { UnifiedReview } from "@/lib/reviews/unified-review";
import { feedPinnedItemSurfaceClassName } from "@/lib/ui/feed-pin-styles";
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
  variant?: "grid" | "list";
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
    </div>
  );
}

export function ReviewCard({
  review,
  isUnread = false,
  showPlatform = false,
  variant = "grid",
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
  const date = new Date(review.createdAt).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  if (variant === "list") {
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
            {review.authorName ? (
              review.contactId && onOpenContact ? (
                <button
                  type="button"
                  className="min-w-0 text-left text-sm font-medium text-foreground underline-offset-4 hover:underline"
                  onClick={onOpenContact}
                >
                  {review.authorName}
                </button>
              ) : (
                <p className={cn("min-w-0 text-sm font-medium", isUnread && "font-semibold")}>
                  {review.authorName}
                </p>
              )
            ) : null}
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

  return (
    <Card
      className={cn(
        "mb-4 break-inside-avoid border-border/50 shadow-card",
        isUnread && "border-accent/35 bg-accent/[0.03]",
        review.hiddenFromPublic && "opacity-80",
        review.isPinned && feedPinnedItemSurfaceClassName,
      )}
    >
      <CardHeader className="space-y-2 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {showPlatform || isUnread ? (
              <ReviewPlatformIcon
                platform={review.platform}
                className="size-4 shrink-0"
                aria-label={
                  isUnread
                    ? `${REVIEW_PLATFORM_LABELS[review.platform]}, ungelesen`
                    : REVIEW_PLATFORM_LABELS[review.platform]
                }
              />
            ) : null}
            <StarsDisplay rating={review.rating} />
            {review.hiddenFromPublic ? (
              <Badge variant="secondary" className="text-[10px]">
                Ausgeblendet
              </Badge>
            ) : null}
            {review.isPinned ? <FeedPinnedBadge /> : null}
          </div>
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
        <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
          {review.authorName ? (
            review.contactId && onOpenContact ? (
              <button
                type="button"
                className="min-w-0 text-left text-sm font-medium text-foreground underline-offset-4 hover:underline"
                onClick={onOpenContact}
              >
                {review.authorName}
              </button>
            ) : (
              <p className={cn("min-w-0 text-sm font-medium", isUnread && "font-semibold")}>
                {review.authorName}
              </p>
            )
          ) : (
            <span className="min-w-0 flex-1" aria-hidden />
          )}
          <div className="flex shrink-0 items-center gap-1">
            <span className="text-xs text-muted-foreground">{date}</span>
          </div>
        </div>
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
      </CardContent>
    </Card>
  );
}

export function ReviewsGridView({
  reviews,
  showPlatform,
  getReviewProps,
}: {
  reviews: UnifiedReview[];
  showPlatform: boolean;
  getReviewProps: (review: UnifiedReview) => Omit<ReviewCardActions, "review" | "showPlatform">;
}) {
  return (
    <div className="columns-1 gap-4 sm:columns-2 xl:columns-3 [contain:layout]">
      {reviews.map((review) => (
        <ReviewCard
          key={`${review.platform}:${review.id}`}
          review={review}
          showPlatform={showPlatform}
          variant="grid"
          {...getReviewProps(review)}
        />
      ))}
    </div>
  );
}

export function ReviewsListView({
  reviews,
  showPlatform,
  getReviewProps,
}: {
  reviews: UnifiedReview[];
  showPlatform: boolean;
  getReviewProps: (review: UnifiedReview) => Omit<ReviewCardActions, "review" | "showPlatform">;
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
