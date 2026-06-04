/** Wochentag-Schlüssel (Mo–So), konsistent mit Intl / DE-UI. */
export type Weekday =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

/** HH:mm (24h), z. B. 11:30 */
export type TimeString = string;

export type DayHours = {
  closed: boolean;
  open?: TimeString;
  close?: TimeString;
};

/** Einzelnes Datum mit abweichenden Öffnungszeiten (Feiertag, Event, …) */
export type DateHoursException = {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  closed: boolean;
  open?: TimeString;
  close?: TimeString;
  note?: string;
};

/** Stammdaten eines Restaurants (später mehrere pro Account). */
export type RestaurantProfile = {
  id: string;
  /** Eindeutiger Nickname → `restaurants.slug` (URL-Kennung). */
  slug: string;
  name: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
  website: string;
  phone: string;
  /** Storage-Pfad im Bucket `restaurant-profile-images`. */
  avatarStoragePath: string | null;
  /** Storage-Pfad im Bucket `restaurant-profile-images`. */
  coverStoragePath: string | null;
  weeklyHours: Record<Weekday, DayHours>;
  dateExceptions: DateHoursException[];
  /** Eigener Wochenplan für die Küche (z. B. Google „Küchenzeiten“ / moreHours KITCHEN). */
  kitchenHoursEnabled: boolean;
  kitchenWeeklyHours: Record<Weekday, DayHours>;
};

export type RestaurantPersistenceV1 = {
  version: 1;
  /** Aktuell bearbeitetes Restaurant (Single-Tenant: i. d. R. `default`). */
  selectedRestaurantId: string;
  restaurants: Record<string, RestaurantProfile>;
};
