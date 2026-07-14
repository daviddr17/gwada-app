import nextDynamic from "next/dynamic";
import type { Metadata } from "next";
import { RestaurantUsageBeacon } from "@/components/insights/restaurant-usage-beacon";
import { embedPageMetadata } from "@/lib/embed/embed-page-metadata";
import {
  EMBED_PREVIEW_TEXT_THEME_PARAM,
  resolveEmbedTextTheme,
} from "@/lib/embed/embed-appearance";
import { fetchEmbedTextThemeForSlug } from "@/lib/embed/fetch-embed-appearance-server";
import { fetchPublicEmbedOpeningHours } from "@/lib/opening-hours/public-opening-hours-server";

const EmbedOpeningHoursWidget = nextDynamic(
  () =>
    import("@/components/embed/embed-opening-hours-widget").then(
      (mod) => mod.EmbedOpeningHoursWidget,
    ),
  { ssr: true },
);

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const result = await fetchPublicEmbedOpeningHours(slug);
  return embedPageMetadata("opening_hours", result.data?.restaurantName);
}

export default async function EmbedOeffnungszeitenPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [EMBED_PREVIEW_TEXT_THEME_PARAM]?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const [result, textTheme] = await Promise.all([
    fetchPublicEmbedOpeningHours(slug),
    fetchEmbedTextThemeForSlug(slug, "opening_hours"),
  ]);

  if (!result.data) {
    return (
      <div className="flex min-h-[12rem] items-center justify-center px-6 py-10 text-center text-sm text-muted-foreground">
        {result.error === "not_found" || result.error === "not_published"
          ? "Diese Öffnungszeiten sind derzeit nicht verfügbar."
          : "Die Öffnungszeiten konnten nicht geladen werden."}
      </div>
    );
  }

  const isPreview = Boolean(sp[EMBED_PREVIEW_TEXT_THEME_PARAM]);

  return (
    <>
      {!isPreview ? (
        <RestaurantUsageBeacon
          slug={slug}
          source="embed"
          dimension="opening_hours"
        />
      ) : null}
      <EmbedOpeningHoursWidget
        {...result.data}
        textTheme={resolveEmbedTextTheme(
          textTheme,
          sp[EMBED_PREVIEW_TEXT_THEME_PARAM],
        )}
      />
    </>
  );
}
