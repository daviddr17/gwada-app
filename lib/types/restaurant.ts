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
  name: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
  website: string;
  phone: string;
  weeklyHours: Record<Weekday, DayHours>;
  dateExceptions: DateHoursException[];
};

export type RestaurantPersistenceV1 = {
  version: 1;
  /** Aktuell bearbeitetes Restaurant (Single-Tenant: i. d. R. `default`). */
  selectedRestaurantId: string;
  restaurants: Record<string, RestaurantProfile>;
};
