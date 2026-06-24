import { openingHoursWeekdayRows } from "@/lib/opening-hours/embed-display-utils";
import type { RestaurantProfile } from "@/lib/types/restaurant";

export const BUSINESS_CARD_WIDTH_MM = 90;
export const BUSINESS_CARD_HEIGHT_MM = 128;
export const BUSINESS_CARD_ASPECT = BUSINESS_CARD_WIDTH_MM / BUSINESS_CARD_HEIGHT_MM;

export type BusinessCardOptions = {
  showCover: boolean;
  showLogo: boolean;
  showAddress: boolean;
  showPhone: boolean;
  showWebsite: boolean;
  showOpeningHours: boolean;
  showGwadaFooter: boolean;
};

export const DEFAULT_BUSINESS_CARD_OPTIONS: BusinessCardOptions = {
  showCover: true,
  showLogo: true,
  showAddress: true,
  showPhone: true,
  showWebsite: true,
  showOpeningHours: true,
  showGwadaFooter: true,
};

export type BusinessCardContent = {
  name: string;
  addressLines: string[];
  phone: string | null;
  websiteLabel: string | null;
  websiteHref: string | null;
  hourRows: Array<{ label: string; value: string }>;
};

export function formatWebsiteDisplay(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  try {
    const host = new URL(
      trimmed.startsWith("http") ? trimmed : `https://${trimmed}`,
    ).host.replace(/^www\./, "");
    return host || trimmed;
  } catch {
    return trimmed.replace(/^https?:\/\//i, "").replace(/\/$/, "");
  }
}

export function normalizeWebsiteHref(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function buildBusinessCardContent(
  profile: RestaurantProfile,
  options: BusinessCardOptions,
): BusinessCardContent {
  const addressLines: string[] = [];
  if (options.showAddress) {
    const street = profile.street?.trim();
    const cityLine = [profile.postalCode?.trim(), profile.city?.trim()]
      .filter(Boolean)
      .join(" ");
    const country = profile.country?.trim();
    if (street) addressLines.push(street);
    if (cityLine) addressLines.push(cityLine);
    if (country) addressLines.push(country);
  }

  const phone = options.showPhone ? profile.phone?.trim() || null : null;
  const websiteRaw = options.showWebsite ? profile.website?.trim() || "" : "";
  const websiteHref = websiteRaw ? normalizeWebsiteHref(websiteRaw) : null;
  const websiteLabel = websiteRaw ? formatWebsiteDisplay(websiteRaw) : null;

  const hourRows = options.showOpeningHours
    ? openingHoursWeekdayRows(profile.weeklyHours)
    : [];

  return {
    name: profile.name.trim() || "Restaurant",
    addressLines,
    phone,
    websiteLabel,
    websiteHref,
    hourRows,
  };
}

export function businessCardPdfFileName(slug: string): string {
  const safe = slug.trim().replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "");
  return `Visitenkarte-${safe || "restaurant"}.pdf`;
}
