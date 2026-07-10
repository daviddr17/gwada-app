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
  note: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type StaffAvailabilitySlotKind = "weekly" | "date";

export type CreateStaffAvailabilitySlotInput = {
  restaurantId: string;
  staffId: string;
  kind: StaffAvailabilitySlotKind;
  weekday?: StaffAvailabilityWeekday | null;
  serviceDate?: string | null;
  startTime: string;
  endTime: string;
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
