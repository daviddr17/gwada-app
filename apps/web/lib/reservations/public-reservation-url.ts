import { GWADA_PRODUCTION_ORIGIN } from "@/lib/constants/gwada-domains";
import { getPublicSiteUrl } from "@/lib/public-env";

export function publicReservationBookingPath(slug: string): string {
  const clean = slug.trim();
  return `/embed/reservieren/${encodeURIComponent(clean)}`;
}

export function publicReservationBookingUrl(
  slug: string,
  origin?: string,
): string {
  const base =
    (origin?.replace(/\/$/, "") ||
      getPublicSiteUrl()?.replace(/\/$/, "") ||
      GWADA_PRODUCTION_ORIGIN);
  return `${base}${publicReservationBookingPath(slug)}`;
}

/** Google Business Links / Meta CTA: Buchungs-URL mit optionalem UTM. */
export function publicReservationBookingUrlForPlatform(
  slug: string,
  platform: "google" | "facebook" | "instagram",
  origin?: string,
): string {
  const url = new URL(publicReservationBookingUrl(slug, origin));
  url.searchParams.set("utm_source", platform);
  url.searchParams.set("utm_medium", "profile");
  url.searchParams.set("utm_campaign", "reserve");
  return url.toString();
}
