import nextDynamic from "next/dynamic";
import type { Metadata } from "next";
import { parseListPageParam } from "@/lib/constants/list-pagination";
import { embedPageMetadata } from "@/lib/embed/embed-page-metadata";
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
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const result = await fetchPublicEmbedReviews(slug, {
    paginate: true,
    page: parseListPageParam(sp.page),
  });

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

  return (
    <EmbedReviewsWidget
      restaurantName={name}
      accentHex={accentHex}
      reviews={reviews}
      summary={summary}
      viewMode={viewMode}
      pagination={pagination}
    />
  );
}
