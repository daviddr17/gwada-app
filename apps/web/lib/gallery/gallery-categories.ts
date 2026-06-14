import type { GalleryPlatform } from "@/lib/constants/gallery-platforms";

/** Google Business Profile Medien-Kategorien → Anzeige (capitalized). */
const GOOGLE_GALLERY_CATEGORY_LABELS: Record<string, string> = {
  COVER: "Cover",
  PROFILE: "Profil",
  LOGO: "Logo",
  EXTERIOR: "Außenansicht",
  INTERIOR: "Innenansicht",
  FOOD_AND_DRINK: "Essen & Getränke",
  FOOD: "Essen",
  MENU: "Speisekarte",
  COMMON_AREA: "Gemeinschaftsbereich",
  ROOMS: "Räume",
  TEAMS: "Team",
  ADDITIONAL: "Weitere",
  AT_WORK: "Bei der Arbeit",
  PRODUCT: "Produkt",
  CUSTOMER: "Kundenfotos",
};

export function googleGalleryCategoryLabel(raw: string | null | undefined): string | null {
  const key = raw?.trim();
  if (!key) return null;
  return GOOGLE_GALLERY_CATEGORY_LABELS[key] ?? capitalizeWords(key.replace(/_/g, " ").toLowerCase());
}

export function facebookGalleryCategoryLabel(raw: string | null | undefined): string | null {
  const name = raw?.trim();
  if (!name) return null;
  return capitalizeWords(name);
}

export function instagramGalleryCategoryLabel(): string {
  return "Markiert";
}

export function gwadaGalleryCategoryLabel(raw: string | null | undefined): string | null {
  const name = raw?.trim();
  if (!name) return null;
  return capitalizeWords(name);
}

export function galleryCategoryLabelForPlatform(
  platform: GalleryPlatform,
  raw: string | null | undefined,
): string | null {
  switch (platform) {
    case "google_business":
      return googleGalleryCategoryLabel(raw);
    case "facebook":
      return facebookGalleryCategoryLabel(raw);
    case "instagram":
      return instagramGalleryCategoryLabel();
    case "gwada":
      return gwadaGalleryCategoryLabel(raw);
    default:
      return raw?.trim() ?? null;
  }
}

function capitalizeWords(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
