import nextDynamic from "next/dynamic";
import type { Metadata } from "next";
import { RestaurantUsageBeacon } from "@/components/insights/restaurant-usage-beacon";
import { embedPageMetadata } from "@/lib/embed/embed-page-metadata";
import {
  EMBED_PREVIEW_TEXT_THEME_PARAM,
  resolveEmbedTextTheme,
} from "@/lib/embed/embed-appearance";
import { fetchEmbedTextThemeForSlug } from "@/lib/embed/fetch-embed-appearance-server";
import { fetchRestaurantDefaultLocaleForSlug } from "@/lib/embed/fetch-restaurant-default-locale";
import { publicCountries } from "@/lib/reservations/public-embed-shared";
import { fetchPublicEmbedRestaurant } from "@/lib/reservations/public-reservation-server";

const EmbedEventInquiryWidget = nextDynamic(
  () =>
    import("@/components/embed/embed-event-inquiry-widget").then(
      (m) => m.EmbedEventInquiryWidget,
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
  const result = await fetchPublicEmbedRestaurant(slug);
  return embedPageMetadata("event_inquiry", result.data?.name);
}

export default async function EmbedVeranstaltungPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [EMBED_PREVIEW_TEXT_THEME_PARAM]?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const [result, textTheme, sourceLocale] = await Promise.all([
    fetchPublicEmbedRestaurant(slug),
    fetchEmbedTextThemeForSlug(slug, "event_inquiry"),
    fetchRestaurantDefaultLocaleForSlug(slug),
  ]);

  if (!result.data) {
    return (
      <div className="flex min-h-[12rem] items-center justify-center px-6 py-10 text-center text-sm text-muted-foreground">
        {result.error === "not_found"
          ? "Dieses Anfrageformular ist derzeit nicht verfügbar."
          : "Das Formular konnte nicht geladen werden."}
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
          dimension="event_inquiry"
        />
      ) : null}
      <EmbedEventInquiryWidget
        config={result.data}
        countries={publicCountries()}
        sourceLocale={sourceLocale}
        textTheme={resolveEmbedTextTheme(
          textTheme,
          sp[EMBED_PREVIEW_TEXT_THEME_PARAM],
        )}
      />
    </>
  );
}
