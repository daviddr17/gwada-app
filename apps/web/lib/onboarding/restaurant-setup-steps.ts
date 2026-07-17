import {
  defaultWeeklyHours,
  WEEKDAY_ORDER,
} from "@/lib/constants/restaurant-profile";
import type { DayHours, Weekday } from "@/lib/types/restaurant";
import { DEFAULT_ACCENT_HEX } from "@/lib/theme/constants";

export const RESTAURANT_SETUP_STEPS = [
  "welcome",
  "identity",
  "location",
  "hours",
  "look",
  "done",
] as const;

export type RestaurantSetupStep = (typeof RESTAURANT_SETUP_STEPS)[number];

export type RestaurantSetupDraft = {
  name: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
  openTime: string;
  closeTime: string;
  openWeekdays: Weekday[];
  accentHex: string;
};

export const SETUP_ACCENT_PRESETS = [
  DEFAULT_ACCENT_HEX,
  "#c45c26",
  "#1d4a3e",
  "#0f3d5c",
  "#8b3a3a",
  "#2c2c2c",
] as const;

export function createEmptyRestaurantSetupDraft(): RestaurantSetupDraft {
  return {
    name: "",
    street: "",
    postalCode: "",
    city: "",
    country: "DE",
    openTime: "11:30",
    closeTime: "22:00",
    openWeekdays: WEEKDAY_ORDER.filter((d) => d !== "sunday"),
    accentHex: DEFAULT_ACCENT_HEX,
  };
}

export function weeklyHoursFromSetupDraft(
  draft: RestaurantSetupDraft,
): Record<Weekday, DayHours> {
  const base = defaultWeeklyHours();
  const openSet = new Set(draft.openWeekdays);
  for (const day of WEEKDAY_ORDER) {
    if (openSet.has(day)) {
      base[day] = {
        closed: false,
        open: draft.openTime || "11:30",
        close: draft.closeTime || "22:00",
      };
    } else {
      base[day] = {
        closed: true,
        open: draft.openTime || "11:30",
        close: draft.closeTime || "22:00",
      };
    }
  }
  return base;
}

export function restaurantSetupStepIndex(step: RestaurantSetupStep): number {
  return RESTAURANT_SETUP_STEPS.indexOf(step);
}

/** Progress steps shown in the chrome (excludes welcome/done). */
export const RESTAURANT_SETUP_PROGRESS_STEPS: RestaurantSetupStep[] = [
  "identity",
  "location",
  "hours",
  "look",
];
