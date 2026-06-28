import { openingHoursWeekdayRows } from "@/lib/opening-hours/embed-display-utils";
import { WEEKDAY_LABEL_DE } from "@/lib/constants/restaurant-profile";
import type {
  BusinessCardElementType,
  BusinessCardOptions,
} from "@/lib/restaurant/business-card-design";
import type { DayHours, RestaurantProfile, Weekday } from "@/lib/types/restaurant";

export {
  BUSINESS_CARD_FORMATS,
  BUSINESS_CARD_FORMAT_OPTIONS,
  businessCardFormatAspect,
  businessCardFormatById,
  businessCardOptionsFromDesign,
  createDefaultBusinessCardDesign,
  defaultBusinessCardColors,
  loadStoredBusinessCardDesign,
  saveStoredBusinessCardDesign,
  type BusinessCardDesign,
  type BusinessCardFormatId,
} from "@/lib/restaurant/business-card-design";

/** Legacy-Default EU 85×55 — Prefer `businessCardFormatById`. */
export const BUSINESS_CARD_WIDTH_MM = 85;
export const BUSINESS_CARD_HEIGHT_MM = 55;
export const BUSINESS_CARD_ASPECT = BUSINESS_CARD_WIDTH_MM / BUSINESS_CARD_HEIGHT_MM;

/** Max Öffnungszeiten-Zeilen auf der Karte (Preview + PDF). */
export const BUSINESS_CARD_MAX_HOUR_ROWS = 4;

export const DEFAULT_BUSINESS_CARD_OPTIONS: BusinessCardOptions = {
  showCover: true,
  showLogo: true,
  showAddress: true,
  showPhone: true,
  showWebsite: true,
  showOpeningHours: true,
  showGwadaFooter: true,
  showGwadaFavicon: false,
  showQrCode: false,
};

export type { BusinessCardOptions };

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

/** Gruppiert aufeinanderfolgende Wochentage mit gleichen Zeiten (kompakt für Visitenkarte). */
export function compactOpeningHourRows(
  weeklyHours: Record<Weekday, DayHours>,
): Array<{ label: string; value: string }> {
  const rows = openingHoursWeekdayRows(weeklyHours);
  const grouped: Array<{ start: Weekday; end: Weekday; value: string }> = [];

  for (const row of rows) {
    const last = grouped[grouped.length - 1];
    if (last && last.value === row.value) {
      last.end = row.day;
    } else {
      grouped.push({ start: row.day, end: row.day, value: row.value });
    }
  }

  return grouped.map(({ start, end, value }) => {
    const startLabel = WEEKDAY_LABEL_DE[start].slice(0, 2);
    const endLabel = WEEKDAY_LABEL_DE[end].slice(0, 2);
    const label = start === end ? startLabel : `${startLabel}–${endLabel}`;
    return { label, value };
  });
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
    ? compactOpeningHourRows(profile.weeklyHours).slice(
        0,
        BUSINESS_CARD_MAX_HOUR_ROWS,
      )
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

/** Hinweis, wenn Stammdaten für ein Inhalts-Element fehlen — dann keine Seiten-Auswahl. */
export function businessCardElementMissingDataHint(
  type: BusinessCardElementType,
  profile: RestaurantProfile,
  opts: { hasCoverImage: boolean },
): string | null {
  switch (type) {
    case "address": {
      const hasAddress = [
        profile.street,
        profile.postalCode,
        profile.city,
        profile.country,
      ].some((part) => Boolean(part?.trim()));
      return hasAddress ? null : "Anschrift in Stammdaten hinterlegen.";
    }
    case "phone":
      return profile.phone?.trim()
        ? null
        : "Telefonnummer in Stammdaten hinterlegen.";
    case "website":
      return profile.website?.trim()
        ? null
        : "Website in Stammdaten hinterlegen.";
    case "cover":
      return opts.hasCoverImage ? null : "Titelbild in Stammdaten hochladen.";
    case "qrCode":
      return profile.website?.trim()
        ? null
        : "Website in Stammdaten hinterlegen.";
    case "openingHours":
      return compactOpeningHourRows(profile.weeklyHours).length > 0
        ? null
        : "Öffnungszeiten in Stammdaten hinterlegen.";
    default:
      return null;
  }
}
