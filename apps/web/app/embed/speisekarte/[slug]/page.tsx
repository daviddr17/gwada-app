import nextDynamic from "next/dynamic";
import type { Metadata } from "next";
import { embedPageMetadata } from "@/lib/embed/embed-page-metadata";
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
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
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

  const { name, accentHex, currencyCode, categories, items, tagDefinitions } =
    result.data;

  return (
    <EmbedMenuWidget
      restaurantName={name}
      accentHex={accentHex}
      currencyCode={currencyCode}
      categories={categories}
      items={items}
      tagDefinitions={tagDefinitions}
      textTheme={textTheme}
    />
  );
}
