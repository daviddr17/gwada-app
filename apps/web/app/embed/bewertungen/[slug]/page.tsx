import nextDynamic from "next/dynamic";
import type { Metadata } from "next";
import { RestaurantUsageBeacon } from "@/components/insights/restaurant-usage-beacon";
import { parseListPageParam } from "@/lib/constants/list-pagination";
import { embedPageMetadata } from "@/lib/embed/embed-page-metadata";
import {
  EMBED_PREVIEW_TEXT_THEME_PARAM,
  resolveEmbedTextTheme,
} from "@/lib/embed/embed-appearance";
import { fetchEmbedTextThemeForSlug } from "@/lib/embed/fetch-embed-appearance-server";
import { fetchPublicEmbedReviews } from "@/lib/reviews/public-reviews-server";

const EmbedReviewsWidget = nextDynamic(
  () =>
    import("@/components/embed/embed-reviews-widget").then(
      (mod) => mod.EmbedReviewsWidget,
    ),
  { ssr: true },
);

export const dynamic = "force-dynamic";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const result = await fetchPublicEmbedReviews(slug);
  return embedPageMetadata("reviews", result.data?.name);
}

export default async function EmbedBewertungenPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string; [EMBED_PREVIEW_TEXT_THEME_PARAM]?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const [result, textTheme] = await Promise.all([
    fetchPublicEmbedReviews(slug, {
      paginate: true,
      page: parseListPageParam(sp.page),
    }),
    fetchEmbedTextThemeForSlug(slug, "reviews"),
  ]);

  if (!result.data) {
    return (
      <div className="flex min-h-[12rem] items-center justify-center px-6 py-10 text-center text-sm text-muted-foreground">
        {result.error === "not_found"
          ? "Diese Bewertungen sind derzeit nicht verfügbar."
          : "Die Bewertungen konnten nicht geladen werden."}
      </div>
    );
  }

  const { name, accentHex, reviews, summary, viewMode, pagination } = result.data;

  const isPreview = Boolean(sp[EMBED_PREVIEW_TEXT_THEME_PARAM]);

  return (
    <>
      {!isPreview ? (
        <RestaurantUsageBeacon slug={slug} source="embed" dimension="reviews" />
      ) : null}
      <EmbedReviewsWidget
        restaurantName={name}
        accentHex={accentHex}
        reviews={reviews}
        summary={summary}
        viewMode={viewMode}
        pagination={pagination}
        textTheme={resolveEmbedTextTheme(
          textTheme,
          sp[EMBED_PREVIEW_TEXT_THEME_PARAM],
        )}
      />
    </>
  );
}
