import type {
  DayHours,
  RestaurantProfile,
  Weekday,
} from "@/lib/types/restaurant";

export const RESTAURANT_STORAGE_KEY = "gwada-restaurant-profile-v1";

/** Feste ID für das eine lokale Restaurant bis Multi-Tenant-UI existiert. */
export const DEFAULT_RESTAURANT_ID = "default";

const defaultDayOpen: DayHours = {
  closed: false,
  open: "11:30",
  close: "22:00",
};

export const WEEKDAY_ORDER: readonly Weekday[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export const WEEKDAY_LABEL_DE: Record<Weekday, string> = {
  monday: "Montag",
  tuesday: "Dienstag",
  wednesday: "Mittwoch",
  thursday: "Donnerstag",
  friday: "Freitag",
  saturday: "Samstag",
  sunday: "Sonntag",
};

/** So ggf. anders als Werktag – klassisches DE-Gastronomie-Default. */
export function defaultWeeklyHours(): Record<Weekday, DayHours> {
  return {
    monday: { ...defaultDayOpen },
    tuesday: { ...defaultDayOpen },
    wednesday: { ...defaultDayOpen },
    thursday: { ...defaultDayOpen },
    friday: { ...defaultDayOpen },
    saturday: { ...defaultDayOpen },
    sunday: { closed: true, open: "12:00", close: "21:00" },
  };
}

/** Startwerte für Küchenzeiten, wenn noch nicht konfiguriert. */
export function defaultKitchenWeeklyHours(): Record<Weekday, DayHours> {
  const kitchenDay: DayHours = {
    closed: false,
    open: "12:00",
    close: "21:30",
  };
  return {
    monday: { ...kitchenDay },
    tuesday: { ...kitchenDay },
    wednesday: { ...kitchenDay },
    thursday: { ...kitchenDay },
    friday: { ...kitchenDay },
    saturday: { ...kitchenDay },
    sunday: { closed: true, open: "12:00", close: "21:00" },
  };
}

export function createDefaultRestaurant(id: string): RestaurantProfile {
  return {
    id,
    slug: "",
    name: "Mein Restaurant",
    street: "",
    postalCode: "",
    city: "",
    country: "Deutschland",
    website: "",
    phone: "",
    avatarStoragePath: null,
    coverStoragePath: null,
    weeklyHours: defaultWeeklyHours(),
    dateExceptions: [],
    kitchenHoursEnabled: false,
    kitchenWeeklyHours: defaultKitchenWeeklyHours(),
  };
}
