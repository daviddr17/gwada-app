"use client";

import { useCallback, useEffect, useMemo, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Star } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { EmbedAccentRoot } from "@/components/embed/embed-accent-root";
import { EmbedResizeReporter } from "@/components/embed/embed-resize-reporter";
import { PublicReviewsTimelineView } from "@/components/reviews/reviews-public-timeline";
import { ListPaginationSurround } from "@/components/ui/list-pagination";
import type { AppLocale } from "@/i18n/config";
import type {
  PublicEmbedReview,
  PublicEmbedReviewsPagination,
} from "@/lib/reviews/public-reviews-server";
import type { EmbedTextTheme } from "@/lib/embed/embed-appearance";
import { cn } from "@/lib/utils";

export type EmbedReviewsWidgetProps = {
  restaurantName: string;
  accentHex: string;
  textTheme?: EmbedTextTheme;
  reviews: PublicEmbedReview[];
  summary: {
    count: number;
    average: number | null;
    median: number | null;
    distribution: Record<1 | 2 | 3 | 4 | 5, number>;
  };
  /** Server-Pagination (Embed-Route) — x/y + Seiten unten. */
  pagination?: PublicEmbedReviewsPagination;
  sourceLocale?: AppLocale;
};

function EmbedReviewsSummary({
  summary,
}: {
  summary: EmbedReviewsWidgetProps["summary"];
}) {
  const t = useTranslations("Embed.reviewsUi");
  const locale = useLocale();
  const maxBar = Math.max(1, ...Object.values(summary.distribution));

  if (summary.count <= 0) return null;

  return (
    <div className="mt-4 grid gap-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-end">
      <div className="flex flex-wrap items-end gap-6">
        <div>
          <p className="text-xs text-muted-foreground">{t("average")}</p>
          <p className="mt-0.5 flex items-baseline gap-2">
            <span className="text-3xl font-semibold tabular-nums">
              {summary.average?.toLocaleString(locale) ?? "—"}
            </span>
            <Star className="size-5 fill-amber-400 text-amber-400" aria-hidden />
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t("count")}</p>
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
              <span className="inline-flex w-10 shrink-0 items-center gap-0.5 text-muted-foreground">
                {stars}
                <Star className="size-3.5" aria-hidden />
              </span>
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
  textTheme = "dark",
  reviews,
  summary,
  pagination,
  sourceLocale = "de",
}: EmbedReviewsWidgetProps) {
  return (
    <EmbedAccentRoot
      accentHex={accentHex}
      textTheme={textTheme}
      sourceLocale={sourceLocale}
    >
      <EmbedReviewsWidgetBody
        restaurantName={restaurantName}
        reviews={reviews}
        summary={summary}
        pagination={pagination}
      />
    </EmbedAccentRoot>
  );
}

function EmbedReviewsWidgetBody({
  restaurantName,
  reviews,
  summary,
  pagination,
}: Omit<EmbedReviewsWidgetProps, "accentHex" | "textTheme" | "sourceLocale">) {
  const t = useTranslations("Embed");
  const tUi = useTranslations("Embed.reviewsUi");
  const locale = useLocale();
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
    [restaurantName, reviews, pagination, summary],
  );

  const showPagination =
    paginated &&
    pagination != null &&
    (pagination.totalPages > 1 || pagination.totalCount > 0);

  const reviewList = (
    <PublicReviewsTimelineView
      reviews={reviews}
      locale={locale}
      emptyCommentLabel={tUi("noComment")}
      moreLabel={tUi("more")}
      lessLabel={tUi("less")}
      replyLabel={tUi("replyLabel")}
    />
  );

  return (
    <>
      <EmbedResizeReporter deps={resizeDeps} widget="reviews" />
      <div
        className="w-full min-w-0 px-4 py-5 sm:px-6"
        data-gwada-embed-content
      >
        {summary.count > 0 ? (
          <div className="border-b border-border/40 pb-5">
            <EmbedReviewsSummary summary={summary} />
          </div>
        ) : null}

        <section className={cn(summary.count > 0 && "mt-5")}>
          {reviews.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("reviewsEmpty")}
            </p>
          ) : showPagination && pagination ? (
            <ListPaginationSurround
              classNameAbove="mb-4 border-b-0 pb-0"
              classNameBelow="mt-4 border-t-0 pt-0"
              page={pagination.page}
              totalPages={pagination.totalPages}
              shown={reviews.length}
              totalCount={pagination.totalCount}
              itemLabel={t("reviews")}
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
      </div>
    </>
  );
}
