import nextDynamic from "next/dynamic";
import type { Metadata } from "next";
import { embedPageMetadata } from "@/lib/embed/embed-page-metadata";
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
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const result = await fetchPublicEmbedOpeningHours(slug);

  if (!result.data) {
    return (
      <div className="flex min-h-[12rem] items-center justify-center px-6 py-10 text-center text-sm text-muted-foreground">
        {result.error === "not_found" || result.error === "not_published"
          ? "Diese Öffnungszeiten sind derzeit nicht verfügbar."
          : "Die Öffnungszeiten konnten nicht geladen werden."}
      </div>
    );
  }

  return <EmbedOpeningHoursWidget {...result.data} />;
}
