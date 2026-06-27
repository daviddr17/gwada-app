"use client";

import { Star } from "lucide-react";
import {
  DashboardCompactInlineMetrics,
  DashboardCompactList,
  DashboardCompactListItem,
  DashboardCompactMetricPill,
} from "@/components/dashboard/dashboard-compact-list";
import { DashboardWidgetShell } from "@/components/dashboard/dashboard-widget-shell";
import { ReviewPlatformIcon } from "@/components/reviews/review-platform-icon";
import { REVIEW_PLATFORM_LABELS } from "@/lib/constants/review-platforms";
import { useDashboardReviewsStats } from "@/lib/hooks/use-dashboard-reviews-stats";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { cn } from "@/lib/utils";

function formatReviewWhen(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "short",
  });
}

function StarsCompact({ rating }: { rating: number }) {
  const full = Math.round(Math.min(5, Math.max(0, rating)));
  return (
    <span className="inline-flex gap-0.5" aria-label={`${rating} von 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={cn(
            "size-3",
            i < full
              ? "fill-muted-foreground text-muted-foreground"
              : "text-muted-foreground/25",
          )}
        />
      ))}
    </span>
  );
}

export function DashboardReviewsTile() {
  const { summary, loading, error, ready } = useDashboardReviewsStats();
  const showSkeleton = useDeferredSkeleton(!ready || (loading && !summary));

  return (
    <DashboardWidgetShell
      title="Bewertungen"
      icon={
        <Star
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
      }
      href="/dashboard/bewertungen/uebersicht"
      linkLabel="Zu Bewertungen"
      ready={ready}
      loading={showSkeleton}
      error={error}
    >
      {summary ? (
        <div className="space-y-3">
          <DashboardCompactInlineMetrics>
            {summary.platforms.map((p) => (
              <DashboardCompactMetricPill
                key={p.platform}
                label={p.label}
                icon={<ReviewPlatformIcon platform={p.platform} />}
                value={
                  p.average != null
                    ? `Ø ${p.average.toLocaleString("de-DE")} · ${p.count}`
                    : p.count > 0
                      ? String(p.count)
                      : "0"
                }
                href={p.href}
              />
            ))}
          </DashboardCompactInlineMetrics>

          {summary.recent.length > 0 ? (
            <DashboardCompactList>
              {summary.recent.map((row) => (
                <DashboardCompactListItem
                  key={`${row.platform}-${row.id}`}
                  href={row.href}
                  leading={
                    row.isUnread ? (
                      <ReviewPlatformIcon
                        platform={row.platform}
                        aria-label={REVIEW_PLATFORM_LABELS[row.platform]}
                      />
                    ) : undefined
                  }
                  title={
                    row.authorName?.trim() ||
                    REVIEW_PLATFORM_LABELS[row.platform]
                  }
                  meta={
                    row.commentPreview ??
                    `${REVIEW_PLATFORM_LABELS[row.platform]} · ${row.rating}★`
                  }
                  trailing={
                    <span className="flex flex-col items-end gap-1">
                      <StarsCompact rating={row.rating} />
                      <span>{formatReviewWhen(row.createdAt)}</span>
                    </span>
                  }
                />
              ))}
            </DashboardCompactList>
          ) : (
            <p className="text-xs text-muted-foreground">
              {summary.unreadRecentCount > 0
                ? "Ungelesene Bewertungen findest du in der Übersicht."
                : "Keine ungelesenen Bewertungen — alles gelesen."}
            </p>
          )}
        </div>
      ) : null}
    </DashboardWidgetShell>
  );
}
