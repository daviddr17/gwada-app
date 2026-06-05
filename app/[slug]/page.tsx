import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DisplayAccentShell } from "@/components/display/display-accent-shell";
import { RestaurantPublicProfileCoverStatic } from "@/components/public/restaurant-public-profile-cover-static";
import { RestaurantPublicProfileHero } from "@/components/public/restaurant-public-profile-hero";
import { RestaurantPublicProfileLauncherDeferred } from "@/components/public/restaurant-public-profile-launcher-deferred";
import { getCachedPublicRestaurantProfile } from "@/lib/restaurant/cached-public-restaurant";
import { isReservedRestaurantSlug } from "@/lib/restaurant/reserved-restaurant-slugs";
import { normalizeRestaurantSlugInput } from "@/lib/restaurant/restaurant-slug";

export const revalidate = 60;

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug: rawSlug } = await params;
  const slug = normalizeRestaurantSlugInput(rawSlug);
  if (!slug || isReservedRestaurantSlug(slug)) {
    return { title: "Profil nicht gefunden" };
  }

  const result = await getCachedPublicRestaurantProfile(slug);
  if (!result.data) {
    return { title: "Profil nicht gefunden" };
  }

  const profile = result.data;
  const title = `gwada - ${profile.name}`;
  const description =
    profile.description ??
    `Reservieren, Speisekarte und mehr — ${profile.name} auf gwada.`;

  const lcpImage = profile.coverUrl ?? profile.avatarUrl;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      ...(lcpImage ? { images: [{ url: lcpImage }] } : {}),
    },
    robots: { index: true, follow: true },
  };
}

export default async function PublicRestaurantProfilePage({ params }: PageProps) {
  const { slug: rawSlug } = await params;
  const slug = normalizeRestaurantSlugInput(rawSlug);

  if (!slug || isReservedRestaurantSlug(slug)) {
    notFound();
  }

  const result = await getCachedPublicRestaurantProfile(slug);
  if (!result.data) {
    notFound();
  }

  const profile = result.data;

  return (
    <DisplayAccentShell accentHex={profile.accentHex}>
      <div className="relative min-h-dvh">
        <RestaurantPublicProfileCoverStatic
          coverUrl={profile.coverUrl}
          accentHex={profile.accentHex}
        />
        <RestaurantPublicProfileHero profile={profile} />
        <RestaurantPublicProfileLauncherDeferred profile={profile} />
      </div>
    </DisplayAccentShell>
  );
}
