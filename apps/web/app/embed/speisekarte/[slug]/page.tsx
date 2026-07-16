import nextDynamic from "next/dynamic";
import type { Metadata } from "next";
import { RestaurantUsageBeacon } from "@/components/insights/restaurant-usage-beacon";
import { embedPageMetadata } from "@/lib/embed/embed-page-metadata";
import {
  EMBED_PREVIEW_TEXT_THEME_PARAM,
  resolveEmbedTextTheme,
} from "@/lib/embed/embed-appearance";
import { fetchEmbedTextThemeForSlug } from "@/lib/embed/fetch-embed-appearance-server";
import { fetchPublicEmbedMenu } from "@/lib/menu/public-menu-server";

const EmbedMenuWidget = nextDynamic(
  () =>
    import("@/components/embed/embed-menu-widget").then((m) => m.EmbedMenuWidget),
  { ssr: true },
);

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const result = await fetchPublicEmbedMenu(slug);
  return embedPageMetadata("menu", result.data?.name);
}

export default async function EmbedSpeisekartePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [EMBED_PREVIEW_TEXT_THEME_PARAM]?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const [result, textTheme] = await Promise.all([
    fetchPublicEmbedMenu(slug),
    fetchEmbedTextThemeForSlug(slug, "menu"),
  ]);

  if (!result.data) {
    return (
      <div className="flex min-h-[12rem] items-center justify-center px-6 py-10 text-center text-sm text-muted-foreground">
        {result.error === "not_found"
          ? "Diese Speisekarte ist derzeit nicht verfügbar."
          : "Die Speisekarte konnte nicht geladen werden."}
      </div>
    );
  }

  const {
    name,
    accentHex,
    currencyCode,
    mainCategories,
    categories,
    items,
    tagDefinitions,
    optionGroups,
  } = result.data;

  const isPreview = Boolean(sp[EMBED_PREVIEW_TEXT_THEME_PARAM]);

  return (
    <>
      {!isPreview ? (
        <RestaurantUsageBeacon slug={slug} source="embed" dimension="menu" />
      ) : null}
      <EmbedMenuWidget
        restaurantName={name}
        accentHex={accentHex}
        currencyCode={currencyCode}
        mainCategories={mainCategories}
        categories={categories}
        items={items}
        tagDefinitions={tagDefinitions}
        optionGroups={optionGroups}
        textTheme={resolveEmbedTextTheme(
          textTheme,
          sp[EMBED_PREVIEW_TEXT_THEME_PARAM],
        )}
      />
    </>
  );
}
