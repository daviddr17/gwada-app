export const POS_ORDER_COURSES = [
  "starter",
  "main",
  "dessert",
  "side",
  "drink",
  "other",
] as const;

export type PosOrderCourse = (typeof POS_ORDER_COURSES)[number];

export const POS_ORDER_COURSE_LABELS_DE: Record<PosOrderCourse, string> = {
  starter: "Vorspeise",
  main: "Hauptgang",
  dessert: "Dessert",
  side: "Beilage",
  drink: "Getränk",
  other: "Sonstiges",
};

export function isPosOrderCourse(value: string): value is PosOrderCourse {
  return (POS_ORDER_COURSES as readonly string[]).includes(value);
}
