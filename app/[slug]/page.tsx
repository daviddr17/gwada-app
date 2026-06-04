import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DisplayAccentRoot } from "@/components/display/display-accent-root";
import { RestaurantPublicProfileCover } from "@/components/public/restaurant-public-profile-cover";
import { RestaurantPublicProfileHero } from "@/components/public/restaurant-public-profile-hero";
import { RestaurantPublicProfileTabs } from "@/components/public/restaurant-public-profile-tabs";
import { fetchPublicRestaurantProfile } from "@/lib/restaurant/public-restaurant-server";
import { isReservedRestaurantSlug } from "@/lib/restaurant/reserved-restaurant-slugs";
import { normalizeRestaurantSlugInput } from "@/lib/restaurant/restaurant-slug";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug: rawSlug } = await params;
  const slug = normalizeRestaurantSlugInput(rawSlug);
  if (!slug || isReservedRestaurantSlug(slug)) {
    return { title: "Profil nicht gefunden" };
  }

  const result = await fetchPublicRestaurantProfile(slug);
  if (!result.data) {
    return { title: "Profil nicht gefunden" };
  }

  const profile = result.data;
  const description =
    profile.description ??
    `Reservieren, Speisekarte und mehr — ${profile.name} auf gwada.`;

  return {
    title: profile.name,
    description,
    openGraph: {
      title: profile.name,
      description,
      type: "website",
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

  const result = await fetchPublicRestaurantProfile(slug);
  if (!result.data) {
    notFound();
  }

  const profile = result.data;

  return (
    <DisplayAccentRoot accentHex={profile.accentHex}>
      <div className="relative min-h-dvh">
        <RestaurantPublicProfileCover
          coverUrl={profile.coverUrl}
          accentHex={profile.accentHex}
        />
        <RestaurantPublicProfileHero profile={profile} />
        <RestaurantPublicProfileTabs profile={profile} />
      </div>
    </DisplayAccentRoot>
  );
}
