import { WEEKDAY_ORDER } from "@/lib/constants/restaurant-profile";
import { getPublicSiteUrl } from "@/lib/public-env";
import type { PublicRestaurantProfile } from "@/lib/restaurant/public-restaurant-server";
import type { Weekday } from "@/lib/types/restaurant";

const WEEKDAY_SCHEMA: Record<Weekday, string> = {
  monday: "https://schema.org/Monday",
  tuesday: "https://schema.org/Tuesday",
  wednesday: "https://schema.org/Wednesday",
  thursday: "https://schema.org/Thursday",
  friday: "https://schema.org/Friday",
  saturday: "https://schema.org/Saturday",
  sunday: "https://schema.org/Sunday",
};

function absolutePublicUrl(pathOrUrl: string): string | null {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const origin = getPublicSiteUrl()?.replace(/\/+$/, "") ?? "";
  if (!origin) return null;
  return pathOrUrl.startsWith("/")
    ? `${origin}${pathOrUrl}`
    : `${origin}/${pathOrUrl}`;
}

/** schema.org Restaurant / LocalBusiness für Gäste-Profil (SEO). */
export function buildPublicRestaurantJsonLd(
  profile: PublicRestaurantProfile,
): Record<string, unknown> {
  const origin = getPublicSiteUrl()?.replace(/\/+$/, "") ?? "";
  const pageUrl = origin ? `${origin}/${profile.slug}` : undefined;
  const image =
    (profile.coverUrl && absolutePublicUrl(profile.coverUrl)) ||
    (profile.avatarUrl && absolutePublicUrl(profile.avatarUrl)) ||
    undefined;

  const openingHoursSpecification = WEEKDAY_ORDER.flatMap((day) => {
    const hours = profile.weeklyHours[day];
    if (!hours || hours.closed || !hours.open || !hours.close) return [];
    return [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: WEEKDAY_SCHEMA[day],
        opens: hours.open,
        closes: hours.close,
      },
    ];
  });

  const address =
    profile.addressLine1 || profile.postalCode || profile.city
      ? {
          "@type": "PostalAddress",
          ...(profile.addressLine1 ? { streetAddress: profile.addressLine1 } : {}),
          ...(profile.postalCode ? { postalCode: profile.postalCode } : {}),
          ...(profile.city ? { addressLocality: profile.city } : {}),
          ...(profile.country ? { addressCountry: profile.country } : {}),
        }
      : undefined;

  const sameAs = profile.socialLinks.map((l) => l.href).filter(Boolean);

  return {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: profile.name,
    ...(pageUrl ? { url: pageUrl, "@id": pageUrl } : {}),
    ...(profile.description ? { description: profile.description } : {}),
    ...(image ? { image } : {}),
    ...(profile.phone ? { telephone: profile.phone } : {}),
    ...(profile.email ? { email: profile.email } : {}),
    ...(profile.website ? { sameAs: [...sameAs, profile.website] } : sameAs.length ? { sameAs } : {}),
    ...(address ? { address } : {}),
    ...(openingHoursSpecification.length
      ? { openingHoursSpecification }
      : {}),
  };
}
