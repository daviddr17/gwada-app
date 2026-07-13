import nextDynamic from "next/dynamic";
import type { Metadata } from "next";
import { RestaurantUsageBeacon } from "@/components/insights/restaurant-usage-beacon";
import { embedPageMetadata } from "@/lib/embed/embed-page-metadata";
import {
  EMBED_PREVIEW_TEXT_THEME_PARAM,
  resolveEmbedTextTheme,
} from "@/lib/embed/embed-appearance";
import { fetchEmbedTextThemeForSlug } from "@/lib/embed/fetch-embed-appearance-server";
import { fetchPublicEmbedNews } from "@/lib/news/public-news-server";

const EmbedNewsWidget = nextDynamic(
  () =>
    import("@/components/embed/embed-news-widget").then((mod) => mod.EmbedNewsWidget),
  { ssr: true },
);

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const result = await fetchPublicEmbedNews(slug);
  return embedPageMetadata("news", result.data?.name);
}

export default async function EmbedNewsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    [EMBED_PREVIEW_TEXT_THEME_PARAM]?: string;
  }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const [result, textTheme] = await Promise.all([
    fetchPublicEmbedNews(slug),
    fetchEmbedTextThemeForSlug(slug, "news"),
  ]);

  if (!result.data) {
    return (
      <div className="flex min-h-[12rem] items-center justify-center px-6 py-10 text-center text-sm text-muted-foreground">
        {result.error === "not_found"
          ? "Diese News sind derzeit nicht verfügbar."
          : "Die News konnten nicht geladen werden."}
      </div>
    );
  }

  const { accentHex, viewMode, connectedPlatforms, items, storyRings, showAllPlatformFilter } =
    result.data;

  const isPreview = Boolean(sp[EMBED_PREVIEW_TEXT_THEME_PARAM]);

  return (
    <>
      {!isPreview ? (
        <RestaurantUsageBeacon slug={slug} source="embed" dimension="news" />
      ) : null}
      <EmbedNewsWidget
        accentHex={accentHex}
        viewMode={viewMode}
        connectedPlatforms={connectedPlatforms}
        items={items}
        storyRings={storyRings}
        showAllPlatformFilter={showAllPlatformFilter}
        textTheme={resolveEmbedTextTheme(
          textTheme,
          sp[EMBED_PREVIEW_TEXT_THEME_PARAM],
        )}
      />
    </>
  );
}
