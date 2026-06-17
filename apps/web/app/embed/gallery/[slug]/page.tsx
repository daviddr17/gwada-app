import type { Metadata } from "next";
import { EmbedGalleryWidget } from "@/components/embed/embed-gallery-widget";
import { embedPageMetadata } from "@/lib/embed/embed-page-metadata";
import {
  EMBED_PREVIEW_TEXT_THEME_PARAM,
  resolveEmbedTextTheme,
} from "@/lib/embed/embed-appearance";
import { fetchEmbedTextThemeForSlug } from "@/lib/embed/fetch-embed-appearance-server";
import { fetchPublicEmbedGallery } from "@/lib/gallery/public-gallery-server";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const result = await fetchPublicEmbedGallery(slug);
  return embedPageMetadata("gallery", result.data?.name);
}

export default async function EmbedGalleryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [EMBED_PREVIEW_TEXT_THEME_PARAM]?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const [result, textTheme] = await Promise.all([
    fetchPublicEmbedGallery(slug),
    fetchEmbedTextThemeForSlug(slug, "gallery"),
  ]);

  if (!result.data) {
    return (
      <div className="flex min-h-[12rem] items-center justify-center px-6 py-10 text-center text-sm text-muted-foreground">
        {result.error === "not_found"
          ? "Diese Galerie ist derzeit nicht verfügbar."
          : "Die Galerie konnte nicht geladen werden."}
      </div>
    );
  }

  return (
    <EmbedGalleryWidget
      data={result.data}
      variant="embed"
      textTheme={resolveEmbedTextTheme(textTheme, sp[EMBED_PREVIEW_TEXT_THEME_PARAM])}
    />
  );
}
