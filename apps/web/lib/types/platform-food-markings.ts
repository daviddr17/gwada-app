import type { FoodMarkingKind } from "@/lib/menu/food-marking-catalog";

export type PlatformFoodMarking = {
  id: string;
  countryCode: string;
  code: string;
  kind: FoodMarkingKind;
  shortLabel: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PlatformFoodMarkingInput = {
  countryCode: string;
  code: string;
  kind: FoodMarkingKind;
  shortLabel: string;
  label: string;
  sortOrder?: number;
  isActive?: boolean;
};

export const PLATFORM_FOOD_MARKING_KINDS: FoodMarkingKind[] = [
  "additive",
  "allergen",
];

export const PLATFORM_FOOD_MARKING_KIND_LABELS: Record<FoodMarkingKind, string> =
  {
    additive: "Zusatzstoff",
    allergen: "Allergen",
  };
