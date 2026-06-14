import "server-only";

import { defaultWeeklyHours } from "@/lib/constants/restaurant-profile";
import type {
  PublicRestaurantProfile,
  PublicRestaurantSocialLink,
} from "@/lib/restaurant/public-restaurant-server";
import type { DayHours, Weekday } from "@/lib/types/restaurant";

const PREVIEW_SOCIAL_LINKS: PublicRestaurantSocialLink[] = [
  {
    kind: "instagram",
    label: "@beispiel.restaurant",
    href: "https://instagram.com/beispiel",
  },
  {
    kind: "facebook",
    label: "Beispiel Restaurant",
    href: "https://www.facebook.com/example",
  },
  {
    kind: "google",
    label: "Google Bewertungen",
    href: "https://maps.google.com/",
  },
];

const PREVIEW_WEEKLY_HOURS = defaultWeeklyHours();

function weeklyHoursLookEmpty(
  hours: Record<Weekday, DayHours>,
): boolean {
  return Object.values(hours).every(
    (day) => day.closed || (!day.open && !day.close),
  );
}

/**
 * Nur `npm run dev` (NODE_ENV=development) — nie auf Production/VPS.
 * Abschalten: `GWADA_LOCAL_PROFILE_PREVIEW=false` in `.env.local`.
 */
export function isLocalPublicProfilePreviewEnabled(): boolean {
  if (process.env.NODE_ENV !== "development") return false;
  if (process.env.GWADA_LOCAL_PROFILE_PREVIEW === "false") return false;
  return true;
}

/** Fehlende Profil-Felder mit Beispieldaten füllen — ausschließlich lokale Entwicklung. */
export function withLocalPublicProfilePreview(
  profile: PublicRestaurantProfile,
): PublicRestaurantProfile {
  if (!isLocalPublicProfilePreviewEnabled()) return profile;

  const weeklyHours = weeklyHoursLookEmpty(profile.weeklyHours)
    ? PREVIEW_WEEKLY_HOURS
    : profile.weeklyHours;

  return {
    ...profile,
    description:
      profile.description ??
      "Regionale Küche mit saisonalen Zutaten — Beispieltext für die lokale Layout-Vorschau.",
    addressLine1: profile.addressLine1 ?? "Musterstraße 12",
    postalCode: profile.postalCode ?? "10115",
    city: profile.city ?? "Berlin",
    country: profile.country ?? "DE",
    phone: profile.phone ?? "+49 30 12345678",
    email: profile.email ?? "kontakt@beispiel-restaurant.de",
    website: profile.website ?? "https://beispiel-restaurant.de",
    socialLinks:
      profile.socialLinks.length > 0 ? profile.socialLinks : PREVIEW_SOCIAL_LINKS,
    weeklyHours,
    modules: {
      reservation: true,
      menu: true,
      reviews: true,
      news: true,
      gallery: true,
    },
  };
}
