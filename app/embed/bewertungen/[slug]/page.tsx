import { EmbedReviewsWidget } from "@/components/embed/embed-reviews-widget";
import { fetchPublicEmbedReviews } from "@/lib/reviews/public-reviews-server";

export const dynamic = "force-dynamic";

export default async function EmbedBewertungenPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const result = await fetchPublicEmbedReviews(slug);

  if (!result.data) {
    return (
      <div className="flex min-h-[12rem] items-center justify-center px-6 py-10 text-center text-sm text-muted-foreground">
        {result.error === "not_found"
          ? "Diese Bewertungen sind derzeit nicht verfügbar."
          : "Die Bewertungen konnten nicht geladen werden."}
      </div>
    );
  }

  const { name, accentHex, reviews, summary } = result.data;

  return (
    <EmbedReviewsWidget
      restaurantName={name}
      accentHex={accentHex}
      reviews={reviews}
      summary={summary}
    />
  );
}
