import nextDynamic from "next/dynamic";
import type { Metadata } from "next";
import { embedPageMetadata } from "@/lib/embed/embed-page-metadata";
import {
  EMBED_PREVIEW_TEXT_THEME_PARAM,
  resolveEmbedTextTheme,
} from "@/lib/embed/embed-appearance";
import { fetchEmbedTextThemeForSlug } from "@/lib/embed/fetch-embed-appearance-server";
import { fetchPublicEmbedEvents } from "@/lib/events/public-events-server";

const EmbedEventsWidget = nextDynamic(
  () =>
    import("@/components/embed/embed-events-widget").then((mod) => mod.EmbedEventsWidget),
  { ssr: true },
);

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const result = await fetchPublicEmbedEvents(slug);
  return embedPageMetadata("events", result.data?.name);
}

export default async function EmbedEventsPage({
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
    fetchPublicEmbedEvents(slug),
    fetchEmbedTextThemeForSlug(slug, "events"),
  ]);

  if (!result.data) {
    return (
      <div className="flex min-h-[12rem] items-center justify-center px-6 py-10 text-center text-sm text-muted-foreground">
        {result.error === "not_found"
          ? "Diese Events sind derzeit nicht verfügbar."
          : "Die Events konnten nicht geladen werden."}
      </div>
    );
  }

  const { accentHex, viewMode, connectedPlatforms, items, pastItems, showAllPlatformFilter } =
    result.data;

  return (
    <EmbedEventsWidget
      accentHex={accentHex}
      viewMode={viewMode}
      connectedPlatforms={connectedPlatforms}
      items={items}
      pastItems={pastItems}
      showAllPlatformFilter={showAllPlatformFilter}
      textTheme={resolveEmbedTextTheme(textTheme, sp[EMBED_PREVIEW_TEXT_THEME_PARAM])}
    />
  );
}
