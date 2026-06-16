import nextDynamic from "next/dynamic";
import type { Metadata } from "next";
import { parseListPageParam } from "@/lib/constants/list-pagination";
import { embedPageMetadata } from "@/lib/embed/embed-page-metadata";
import { fetchEmbedTextThemeForSlug } from "@/lib/embed/fetch-embed-appearance-server";
import {
  fetchPublicEmbedNews,
  parseNewsEmbedPlatformFilter,
} from "@/lib/news/public-news-server";

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
  searchParams: Promise<{ page?: string; platform?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const [result, textTheme] = await Promise.all([
    fetchPublicEmbedNews(slug, {
      paginate: true,
      page: parseListPageParam(sp.page),
      platform: parseNewsEmbedPlatformFilter(sp.platform),
    }),
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

  const { accentHex, viewMode, connectedPlatforms, items, pagination } =
    result.data;

  return (
    <EmbedNewsWidget
      accentHex={accentHex}
      viewMode={viewMode}
      connectedPlatforms={connectedPlatforms}
      items={items}
      pagination={pagination}
      textTheme={textTheme}
    />
  );
}
