"use client";

import { useCallback, useEffect, useState } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
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
import { ReviewSummaryCard } from "@/components/reviews/review-summary-card";
import { settingsAccentSaveButtonClassName } from "@/components/settings/settings-sticky-save-bar";
import type { ReviewPlatform } from "@/lib/constants/review-platforms";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import type { UnifiedReview } from "@/lib/reviews/unified-review";
import { cn } from "@/lib/utils";

type ReviewsApiResponse = {
  reviews: UnifiedReview[];
  summary: {
    count: number;
    average: number | null;
    median: number | null;
    distribution: Record<1 | 2 | 3 | 4 | 5, number>;
  };
  loadError?: string | null;
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
}: {
  review: UnifiedReview;
  onReply?: () => void;
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
          <span className="shrink-0 text-xs text-muted-foreground">{date}</span>
        </div>
        {review.authorName ? (
          <p className="text-sm font-medium">{review.authorName}</p>
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

export function ReviewsScreen({ platform }: { platform: ReviewPlatform }) {
  const { restaurantId, ready } = useWorkspaceRestaurantUuid();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReviewsApiResponse | null>(null);
  const [replyTarget, setReplyTarget] = useState<UnifiedReview | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyBusy, setReplyBusy] = useState(false);
  const showSkeleton = useDeferredSkeleton(loading);

  const load = useCallback(async () => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/reviews?${new URLSearchParams({ restaurantId, platform })}`,
      );
      const json = (await res.json()) as ReviewsApiResponse & { error?: string };
      if (!res.ok) {
        toast.error(json.error ?? "Bewertungen konnten nicht geladen werden.");
        setData(null);
        return;
      }
      setData(json);
    } catch {
      toast.error("Netzwerkfehler beim Laden der Bewertungen.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [restaurantId, platform]);

  useEffect(() => {
    void load();
  }, [load]);

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
      void load();
    } finally {
      setReplyBusy(false);
    }
  };

  if (!ready) {
    return <WorkspaceRestaurantResolvePlaceholder />;
  }
  if (!restaurantId) {
    return <WorkspaceRestaurantMissingMessage />;
  }

  const loadError = data?.loadError;
  const reviews = data?.reviews ?? [];

  return (
    <div className="space-y-6">
      {platform === "gwada" ? (
        <p className="text-sm text-muted-foreground">
          Gwada-Bewertungen sind nur über den persönlichen Einladungslink nach
          einer Reservierung möglich. Einstellungen unter{" "}
          <a
            href="/reservierungen/einstellungen"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Reservierungen → Einstellungen
          </a>
          .
        </p>
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

      {showSkeleton ? (
        <>
          <div className="skeleton-shimmer h-28 rounded-2xl" />
          <ReviewsGridSkeleton />
        </>
      ) : data ? (
        <>
          <ReviewSummaryCard summary={data.summary} />
          {reviews.length === 0 ? (
            <Card className="border-border/50 shadow-card">
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                Noch keine Bewertungen auf dieser Plattform.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {reviews.map((review) => (
                <ReviewCard
                  key={review.id}
                  review={review}
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
    </div>
  );
}
