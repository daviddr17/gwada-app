import type { Weekday } from "@/lib/types/restaurant";

export type StaffAvailabilityWeekday = Weekday;

export type RestaurantStaffAvailabilitySlotRow = {
  id: string;
  restaurant_id: string;
  staff_id: string;
  weekday: StaffAvailabilityWeekday | null;
  service_date: string | null;
  start_time: string;
  end_time: string;
  /** false = ganztägig nicht einsetzbar (nur service_date). */
  is_available: boolean;
  note: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/** @deprecated Neue UI speichert nur Datums-Slots; weekly bleibt für Altbestand. */
export type StaffAvailabilitySlotKind = "weekly" | "date";

/** Polarität: verfügbar (Zeitfenster) oder nicht einsetzbar. */
export type StaffAvailabilityPolarity = "available" | "unavailable";

/** Ganztägige Nicht-Verfügbarkeit (DB: time NOT NULL + end > start). */
export const STAFF_AVAILABILITY_ALL_DAY_START = "00:00";
export const STAFF_AVAILABILITY_ALL_DAY_END = "23:59";

export type CreateStaffAvailabilitySlotInput = {
  restaurantId: string;
  staffId: string;
  kind: StaffAvailabilitySlotKind;
  weekday?: StaffAvailabilityWeekday | null;
  serviceDate?: string | null;
  startTime: string;
  endTime: string;
  /** Default true. false nur mit kind „date“ (ganztägig). */
  isAvailable?: boolean;
  note?: string | null;
};

export type CreateStaffAvailabilityDateSlotsInput = {
  restaurantId: string;
  staffId: string;
  serviceDates: string[];
  startTime: string;
  endTime: string;
  isAvailable?: boolean;
  note?: string | null;
};

export const STAFF_AVAILABILITY_WEEKDAY_LABELS: Record<
  StaffAvailabilityWeekday,
  string
> = {
  monday: "Montag",
  tuesday: "Dienstag",
  wednesday: "Mittwoch",
  thursday: "Donnerstag",
  friday: "Freitag",
  saturday: "Samstag",
  sunday: "Sonntag",
};

export const STAFF_AVAILABILITY_WEEKDAY_SHORT_LABELS: Record<
  StaffAvailabilityWeekday,
  string
> = {
  monday: "Mo",
  tuesday: "Di",
  wednesday: "Mi",
  thursday: "Do",
  friday: "Fr",
  saturday: "Sa",
  sunday: "So",
};

export const STAFF_AVAILABILITY_WEEKDAY_ORDER: readonly StaffAvailabilityWeekday[] =
  [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];
