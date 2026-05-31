import {
  createDefaultRestaurant,
  DEFAULT_RESTAURANT_ID,
  defaultWeeklyHours,
  WEEKDAY_LABEL_DE,
  WEEKDAY_ORDER,
} from "@/lib/constants/restaurant-profile";
import {
  isUuidRestaurantId,
  openingHoursDbEnabled,
} from "@/lib/supabase/opening-hours-db";
import { defaultExceptionDateString } from "@/lib/restaurant/date-exception-utils";
import {
  normalizeRestaurantSlugInput,
  validateRestaurantSlugInput,
} from "@/lib/restaurant/restaurant-slug";
import type {
  DayHours,
  RestaurantPersistenceV1,
  RestaurantProfile,
  Weekday,
} from "@/lib/types/restaurant";

export function mergeRestaurantProfile(
  id: string,
  partial?: Partial<RestaurantProfile> | null,
): RestaurantProfile {
  const base = createDefaultRestaurant(id);
  if (!partial) return base;

  const weekly: Record<Weekday, DayHours> = { ...base.weeklyHours };
  for (const day of WEEKDAY_ORDER) {
    weekly[day] = {
      ...base.weeklyHours[day],
      ...partial.weeklyHours?.[day],
    };
  }

  return {
    ...base,
    ...partial,
    id,
    weeklyHours: weekly,
    dateExceptions: Array.isArray(partial.dateExceptions)
      ? partial.dateExceptions
      : base.dateExceptions,
  };
}

/**
 * UUID-Restaurants: Öffnungszeiten liegen in `opening_hours`, nicht im JSON-Payload.
 */
export function persistenceStripOpeningHoursForRemote(
  persistence: RestaurantPersistenceV1,
): RestaurantPersistenceV1 {
  if (!openingHoursDbEnabled()) return persistence;
  return {
    ...persistence,
    restaurants: Object.fromEntries(
      Object.entries(persistence.restaurants).map(([id, prof]) => [
        id,
        isUuidRestaurantId(id)
          ? {
              ...prof,
              weeklyHours: defaultWeeklyHours(),
              dateExceptions: [],
            }
          : prof,
      ]),
    ) as Record<string, RestaurantProfile>,
  };
}

export function parsePersistence(raw: string | null): RestaurantPersistenceV1 {
  const fallback: RestaurantPersistenceV1 = {
    version: 1,
    selectedRestaurantId: DEFAULT_RESTAURANT_ID,
    restaurants: {
      [DEFAULT_RESTAURANT_ID]: createDefaultRestaurant(DEFAULT_RESTAURANT_ID),
    },
  };
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as Partial<RestaurantPersistenceV1>;
    if (parsed?.version !== 1) {
      return fallback;
    }
    const selectedId =
      typeof parsed.selectedRestaurantId === "string" &&
      parsed.selectedRestaurantId
        ? parsed.selectedRestaurantId
        : DEFAULT_RESTAURANT_ID;
    const restaurants: Record<string, RestaurantProfile> = {
      ...fallback.restaurants,
    };
    if (parsed.restaurants && typeof parsed.restaurants === "object") {
      for (const [key, value] of Object.entries(parsed.restaurants)) {
        restaurants[key] = mergeRestaurantProfile(
          key,
          value as Partial<RestaurantProfile>,
        );
      }
    }
    if (!restaurants[selectedId]) {
      restaurants[selectedId] = createDefaultRestaurant(selectedId);
    }
    return {
      version: 1,
      selectedRestaurantId: selectedId,
      restaurants,
    };
  } catch {
    return fallback;
  }
}

export function normalizeWebsite(input: string): string {
  const t = input.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

export function validateRestaurantStammdaten(
  p: RestaurantProfile,
): string | null {
  if (!p.name?.trim()) {
    return "Bitte einen Restaurantnamen eintragen.";
  }
  return validateRestaurantSlugInput(p.slug);
}

export function validateOpeningHours(p: RestaurantProfile): string | null {
  for (const day of WEEKDAY_ORDER) {
    const h = p.weeklyHours[day];
    if (!h.closed && (!h.open?.trim() || !h.close?.trim())) {
      return `Bitte Öffnungszeiten für ${WEEKDAY_LABEL_DE[day]} ergänzen oder als geschlossen markieren.`;
    }
  }

  const seenDates = new Set<string>();
  for (const ex of p.dateExceptions) {
    if (!ex.date || !/^\d{4}-\d{2}-\d{2}$/.test(ex.date)) {
      return "Bitte gültiges Datum (YYYY-MM-DD) bei allen Ausnahmen eintragen.";
    }
    if (seenDates.has(ex.date)) {
      return `Datum ${ex.date} ist mehrfach eingetragen.`;
    }
    seenDates.add(ex.date);
    if (!ex.closed && (!ex.open?.trim() || !ex.close?.trim())) {
      return `Bei Ausnahme am ${ex.date}: Zeiten angeben oder „geschlossen“ aktivieren.`;
    }
  }

  return null;
}

/** Stammdaten + Öffnungszeiten (Komplettprüfung). */
export function validateProfile(p: RestaurantProfile): string | null {
  return validateRestaurantStammdaten(p) ?? validateOpeningHours(p);
}

/** Vor dem Speichern: trimmen, leere Website normalisieren, Sortierung */
export function normalizeProfileForSave(p: RestaurantProfile): RestaurantProfile {
  return {
    ...p,
    slug: normalizeRestaurantSlugInput(p.slug),
    name: p.name.trim() || "Mein Restaurant",
    street: p.street.trim(),
    postalCode: p.postalCode.trim(),
    city: p.city.trim(),
    country: p.country.trim() || "Deutschland",
    website: normalizeWebsite(p.website),
    phone: p.phone.trim(),
    dateExceptions: [...p.dateExceptions]
      .map((ex) => {
        const trimmed = ex.date?.trim() ?? "";
        const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(trimmed);
        return {
          ...ex,
          date: dateOk ? trimmed : defaultExceptionDateString(),
          note: ex.note?.trim() || undefined,
          open: ex.closed ? undefined : ex.open?.trim(),
          close: ex.closed ? undefined : ex.close?.trim(),
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date)),
  };
}
