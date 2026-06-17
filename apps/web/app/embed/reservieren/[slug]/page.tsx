import nextDynamic from "next/dynamic";
import type { Metadata } from "next";
import { embedPageMetadata } from "@/lib/embed/embed-page-metadata";
import {
  EMBED_PREVIEW_TEXT_THEME_PARAM,
  resolveEmbedTextTheme,
} from "@/lib/embed/embed-appearance";
import { fetchEmbedTextThemeForSlug } from "@/lib/embed/fetch-embed-appearance-server";
import { publicCountries } from "@/lib/reservations/public-embed-shared";
import { fetchPublicEmbedRestaurant } from "@/lib/reservations/public-reservation-server";

const EmbedReservationWidget = nextDynamic(
  () =>
    import("@/components/embed/embed-reservation-widget").then(
      (m) => m.EmbedReservationWidget,
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
  return embedPageMetadata("reservation", result.data?.name);
}

export default async function EmbedReservierenPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [EMBED_PREVIEW_TEXT_THEME_PARAM]?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const [result, textTheme] = await Promise.all([
    fetchPublicEmbedRestaurant(slug),
    fetchEmbedTextThemeForSlug(slug, "reservation"),
  ]);

  if (!result.data) {
    return (
      <div className="flex min-h-[12rem] items-center justify-center px-6 py-10 text-center text-sm text-muted-foreground">
        {result.error === "not_found"
          ? "Dieses Reservierungsformular ist derzeit nicht verfügbar."
          : "Das Formular konnte nicht geladen werden."}
      </div>
    );
  }

  return (
    <EmbedReservationWidget
      config={result.data}
      countries={publicCountries()}
      textTheme={resolveEmbedTextTheme(textTheme, sp[EMBED_PREVIEW_TEXT_THEME_PARAM])}
    />
  );
}
