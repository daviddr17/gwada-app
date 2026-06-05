"use client";

import { Star } from "lucide-react";
import { EmbedAccentRoot } from "@/components/embed/embed-accent-root";
import { EmbedResizeReporter } from "@/components/embed/embed-resize-reporter";
import type { PublicEmbedReview } from "@/lib/reviews/public-reviews-server";
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

function EmbedReviewRow({ review }: { review: PublicEmbedReview }) {
  const date = new Date(review.createdAt).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <article className="border-b border-border/40 py-4 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <StarsDisplay rating={review.rating} />
        <time className="shrink-0 text-xs text-muted-foreground" dateTime={review.createdAt}>
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
    </article>
  );
}

export function EmbedReviewsWidget({
  restaurantName,
  accentHex,
  reviews,
  summary,
}: EmbedReviewsWidgetProps) {
  const maxBar = Math.max(1, ...Object.values(summary.distribution));

  return (
    <EmbedAccentRoot accentHex={accentHex}>
      <EmbedResizeReporter deps={[reviews.length, summary.count]} widget="reviews" />
      <div className="px-4 py-6 sm:px-6">
        <header className="border-b border-border/40 pb-6">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Bewertungen
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">{restaurantName}</h1>
          {summary.count > 0 ? (
            <div className="mt-4 flex flex-wrap items-end gap-6">
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
          ) : null}
          {summary.count > 0 ? (
            <div className="mt-5 max-w-md space-y-1.5">
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
          ) : null}
        </header>

        <section className="mt-6">
          {reviews.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Noch keine Bewertungen — Gäste können nach dem Besuch über Gwada
              bewerten.
            </p>
          ) : (
            <div>
              {reviews.map((r) => (
                <EmbedReviewRow key={`${r.platform}-${r.id}`} review={r} />
              ))}
            </div>
          )}
        </section>

        <p className="mt-8 text-center text-[11px] text-muted-foreground/80">
          Bewertungen über Gwada und verbundene Plattformen
        </p>
      </div>
    </EmbedAccentRoot>
  );
}
