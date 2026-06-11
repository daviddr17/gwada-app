import nextDynamic from "next/dynamic";
import { fetchPublicEmbedNews } from "@/lib/news/public-news-server";

const EmbedNewsWidget = nextDynamic(
  () =>
    import("@/components/embed/embed-news-widget").then((mod) => mod.EmbedNewsWidget),
  { ssr: true },
);

export const revalidate = 60;

export default async function EmbedNewsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const result = await fetchPublicEmbedNews(slug);

  if (!result.data) {
    return (
      <div className="flex min-h-[12rem] items-center justify-center px-6 py-10 text-center text-sm text-muted-foreground">
        {result.error === "not_found"
          ? "Diese News sind derzeit nicht verfügbar."
          : "Die News konnten nicht geladen werden."}
      </div>
    );
  }

  const { accentHex, viewMode, connectedPlatforms, items } = result.data;

  return (
    <EmbedNewsWidget
      accentHex={accentHex}
      viewMode={viewMode}
      connectedPlatforms={connectedPlatforms}
      items={items}
    />
  );
}
