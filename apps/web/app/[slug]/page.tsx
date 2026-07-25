import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { preload } from "react-dom";
import { DisplayAccentShell } from "@/components/display/display-accent-shell";
import { LocalProfilePreviewBadge } from "@/components/public/local-profile-preview-badge";
import { RestaurantPublicProfileHeroChrome } from "@/components/public/restaurant-public-profile-hero-chrome";
import { RestaurantPublicProfilePageShell } from "@/components/public/restaurant-public-profile-page-shell";
import { isLocalPublicProfilePreviewEnabled } from "@/lib/public-profile/local-public-profile-preview";
import { getPublicSiteUrl } from "@/lib/public-env";
import { getCachedRootLayoutBranding } from "@/lib/platform/cached-layout-branding";
import { resolvePublicSplashIconSrc } from "@/lib/platform/resolve-public-splash-icon";
import { getCachedPublicRestaurantProfile } from "@/lib/restaurant/cached-public-restaurant";
import { isReservedRestaurantSlug } from "@/lib/restaurant/reserved-restaurant-slugs";
import { normalizeRestaurantSlugInput } from "@/lib/restaurant/restaurant-slug";

export const revalidate = 60;

type PageProps = {
  params: Promise<{ slug: string }>;
};

function absolutePublicUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const origin = getPublicSiteUrl()?.replace(/\/+$/, "") ?? "";
  if (!origin) return pathOrUrl;
  return pathOrUrl.startsWith("/")
    ? `${origin}${pathOrUrl}`
    : `${origin}/${pathOrUrl}`;
}

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
      ...(lcpImage
        ? { images: [{ url: absolutePublicUrl(lcpImage) }] }
        : {}),
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
  const branding = await getCachedRootLayoutBranding();
  const gwadaIconSrc = resolvePublicSplashIconSrc(branding);

  const lcpImage = profile.coverUrl ?? profile.avatarUrl;
  if (lcpImage) {
    preload(lcpImage, { as: "image", fetchPriority: "high" });
  }
  if (profile.avatarUrl && profile.coverUrl) {
    preload(profile.avatarUrl, { as: "image" });
  }
  if (gwadaIconSrc) {
    preload(gwadaIconSrc, { as: "image" });
  }

  return (
    <DisplayAccentShell accentHex={profile.accentHex}>
      {isLocalPublicProfilePreviewEnabled() ? <LocalProfilePreviewBadge /> : null}
      {/* LCP: echtes Hero im RSC-HTML — unabhängig vom Client-Launcher-Chunk */}
      <div data-public-profile-ssr-hero>
        <RestaurantPublicProfileHeroChrome profile={profile} />
      </div>
      <RestaurantPublicProfilePageShell
        profile={profile}
        gwadaIconSrc={gwadaIconSrc}
        initialBranding={branding}
        ssrHero
      />
    </DisplayAccentShell>
  );
}
