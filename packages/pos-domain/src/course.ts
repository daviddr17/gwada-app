export const POS_UI_COURSES = [1, 2, 3] as const;

export type PosUiCourse = (typeof POS_UI_COURSES)[number];

/** Wire/DB course number (>= 1). */
export type PosOrderCourse = number;

const LEGACY_COURSE_TO_INT: Record<string, number> = {
  "1": 1,
  "2": 2,
  "3": 3,
  starter: 1,
  main: 2,
  dessert: 3,
  side: 2,
  drink: 2,
  other: 2,
};

export function isPosOrderCourse(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

/** Normalize API/DB/legacy input to Int >= 1; unknown → 2 (Hauptgang). */
export function normalizePosOrderCourse(value: unknown): number {
  if (typeof value === "number" && Number.isInteger(value) && value >= 1) {
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (Object.prototype.hasOwnProperty.call(LEGACY_COURSE_TO_INT, trimmed)) {
      return LEGACY_COURSE_TO_INT[trimmed]!;
    }
    const n = Number(trimmed);
    if (Number.isInteger(n) && n >= 1) return n;
  }
  return 2;
}

export function posOrderCourseLabelDe(course: number): string {
  switch (course) {
    case 1:
      return "Vorspeise";
    case 2:
      return "Hauptgang";
    case 3:
      return "Dessert";
    default:
      return `Gang ${course}`;
  }
}

export function posOrderCourseShortLabelDe(course: number): string {
  switch (course) {
    case 1:
      return "V";
    case 2:
      return "H";
    case 3:
      return "D";
    default:
      return String(course);
  }
}

/** @deprecated Use POS_UI_COURSES — kept briefly if any import breaks mid-refactor. */
export const POS_ORDER_COURSES = POS_UI_COURSES;

/** @deprecated Use posOrderCourseLabelDe(course). */
export const POS_ORDER_COURSE_LABELS_DE: Record<number, string> = {
  1: "Vorspeise",
  2: "Hauptgang",
  3: "Dessert",
};
