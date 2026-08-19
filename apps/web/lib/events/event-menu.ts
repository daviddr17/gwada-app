import { parseEventPackageMoney } from "@/lib/events/event-package";

export const EVENT_MENU_DIET_KEYS = [
  "vegetarian",
  "vegan",
  "gluten_free",
  "lactose_free",
  "no_pork",
  "kids",
] as const;

export type EventMenuDietKey = (typeof EVENT_MENU_DIET_KEYS)[number];

export const EVENT_MENU_DIET_LABELS: Record<EventMenuDietKey, string> = {
  vegetarian: "Vegetarisch",
  vegan: "Vegan",
  gluten_free: "Glutenfrei",
  lactose_free: "Laktosefrei",
  no_pork: "Ohne Schwein",
  kids: "Kinder",
};

export const EVENT_MENU_COURSE_MODES = ["fixed", "split"] as const;
export type EventMenuCourseMode = (typeof EVENT_MENU_COURSE_MODES)[number];

export const EVENT_MENU_ADDON_BILLINGS = ["per_person", "flat"] as const;
export type EventMenuAddonBilling = (typeof EVENT_MENU_ADDON_BILLINGS)[number];

export const EVENT_MENU_COURSE_MODE_LABELS: Record<EventMenuCourseMode, string> = {
  fixed: "Für alle inklusive",
  split: "Gäste wählen nach Personen",
};

export const EVENT_MENU_ADDON_BILLING_LABELS: Record<EventMenuAddonBilling, string> = {
  per_person: "Pro Person",
  flat: "Pauschale",
};

export const EVENT_MENU_MAX_COURSES = 8;
export const EVENT_MENU_MAX_OPTIONS_PER_COURSE = 12;
export const EVENT_MENU_MAX_ADDONS = 8;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isEventMenuId(value: string): boolean {
  return UUID_RE.test(value);
}

export function isEventMenuDietKey(value: string): value is EventMenuDietKey {
  return (EVENT_MENU_DIET_KEYS as readonly string[]).includes(value);
}

export function isEventMenuCourseMode(value: string): value is EventMenuCourseMode {
  return (EVENT_MENU_COURSE_MODES as readonly string[]).includes(value);
}

export function isEventMenuAddonBilling(
  value: string,
): value is EventMenuAddonBilling {
  return (EVENT_MENU_ADDON_BILLINGS as readonly string[]).includes(value);
}

export type EventMenuCourseOption = {
  id: string;
  name: string;
  description: string;
  extraPricePerPerson: number;
  diets: EventMenuDietKey[];
  sortOrder: number;
};

export type EventMenuCourse = {
  id: string;
  name: string;
  selectionMode: EventMenuCourseMode;
  required: boolean;
  sortOrder: number;
  options: EventMenuCourseOption[];
};

export type EventMenuAddon = {
  id: string;
  name: string;
  description: string;
  price: number;
  billing: EventMenuAddonBilling;
  excludeKids: boolean;
  sortOrder: number;
};

export type EventMenu = {
  id: string;
  restaurantId: string;
  name: string;
  description: string;
  pricePerPerson: number;
  kidsPricePerPerson: number | null;
  taxRatePercent: number;
  minPartySize: number;
  maxPartySize: number | null;
  active: boolean;
  sortOrder: number;
  courses: EventMenuCourse[];
  addons: EventMenuAddon[];
};

export type PublicEventMenu = Pick<
  EventMenu,
  | "id"
  | "name"
  | "description"
  | "pricePerPerson"
  | "kidsPricePerPerson"
  | "minPartySize"
  | "maxPartySize"
  | "courses"
  | "addons"
>;

export type EventMenuWishes = {
  vegetarian: number;
  vegan: number;
  gluten_free: number;
  lactose_free: number;
  no_pork: number;
  kids: number;
};

export const EMPTY_EVENT_MENU_WISHES: EventMenuWishes = {
  vegetarian: 0,
  vegan: 0,
  gluten_free: 0,
  lactose_free: 0,
  no_pork: 0,
  kids: 0,
};

export type EventMenuSelection = {
  menuId: string | null;
  courseCounts: Record<string, Record<string, number>>;
  addonCounts: Record<string, number>;
  wishes: EventMenuWishes;
};

export const EMPTY_EVENT_MENU_SELECTION: EventMenuSelection = {
  menuId: null,
  courseCounts: {},
  addonCounts: {},
  wishes: { ...EMPTY_EVENT_MENU_WISHES },
};

export type EventMenuWriteFields = {
  name: string;
  description: string;
  pricePerPerson: number;
  kidsPricePerPerson: number | null;
  taxRatePercent: number;
  minPartySize: number;
  maxPartySize: number | null;
  active: boolean;
  sortOrder: number;
  courses: EventMenuCourse[];
  addons: EventMenuAddon[];
};

export type EventMenuQuoteLine = {
  name: string;
  description: string | null;
  quantity: number;
  unitName: string;
  unitPrice: number;
};

export function eventMenuFitsPartySize(
  menu: Pick<EventMenu, "minPartySize" | "maxPartySize">,
  partySize: number,
): boolean {
  if (!Number.isFinite(partySize) || partySize < 1) return false;
  if (partySize < menu.minPartySize) return false;
  if (menu.maxPartySize != null && partySize > menu.maxPartySize) return false;
  return true;
}

export function eventMenuPartyRangeLabel(
  menu: Pick<EventMenu, "minPartySize" | "maxPartySize">,
): string | null {
  if (menu.minPartySize <= 1 && menu.maxPartySize == null) return null;
  if (menu.maxPartySize == null) return `ab ${menu.minPartySize} Pers.`;
  if (menu.minPartySize <= 1) return `bis ${menu.maxPartySize} Pers.`;
  return `${menu.minPartySize}–${menu.maxPartySize} Pers.`;
}

export function clampEventMenuWishes(
  wishes: EventMenuWishes,
  partySize: number,
): EventMenuWishes {
  const max = Number.isFinite(partySize) ? Math.max(0, Math.trunc(partySize)) : 0;
  const clamp = (n: number) =>
    Math.min(max, Math.max(0, Number.isFinite(n) ? Math.trunc(n) : 0));
  return {
    vegetarian: clamp(wishes.vegetarian),
    vegan: clamp(wishes.vegan),
    gluten_free: clamp(wishes.gluten_free),
    lactose_free: clamp(wishes.lactose_free),
    no_pork: clamp(wishes.no_pork),
    kids: clamp(wishes.kids),
  };
}

export function eventMenuAdultAndKidsCount(
  partySize: number,
  wishes: Pick<EventMenuWishes, "kids">,
): { adults: number; kids: number } {
  const people = Number.isFinite(partySize) ? Math.max(0, Math.trunc(partySize)) : 0;
  const kids = Math.min(people, Math.max(0, Math.trunc(wishes.kids || 0)));
  return { adults: people - kids, kids };
}

export function optionMatchesDiet(
  option: Pick<EventMenuCourseOption, "diets">,
  diet: EventMenuDietKey,
): boolean {
  if (option.diets.includes(diet)) return true;
  if (diet === "vegetarian" && option.diets.includes("vegan")) return true;
  if (diet === "no_pork" && (option.diets.includes("vegetarian") || option.diets.includes("vegan"))) {
    return true;
  }
  return false;
}

function optionCount(
  selection: EventMenuSelection,
  courseId: string,
  optionId: string,
): number {
  const raw = selection.courseCounts[courseId]?.[optionId];
  if (!Number.isFinite(raw)) return 0;
  return Math.max(0, Math.trunc(raw));
}

export function courseAssignedCount(
  course: Pick<EventMenuCourse, "id" | "options">,
  selection: EventMenuSelection,
): number {
  return course.options.reduce(
    (sum, option) => sum + optionCount(selection, course.id, option.id),
    0,
  );
}

export function courseDietAssignedCount(
  course: Pick<EventMenuCourse, "id" | "options">,
  selection: EventMenuSelection,
  diet: EventMenuDietKey,
): number {
  return course.options.reduce((sum, option) => {
    if (!optionMatchesDiet(option, diet)) return sum;
    return sum + optionCount(selection, course.id, option.id);
  }, 0);
}

export type EventMenuCourseIssue = {
  courseId: string;
  expected: number;
  assigned: number;
};

export function splitCourseExpectedCount(
  course: Pick<EventMenuCourse, "selectionMode" | "required" | "options">,
  partySize: number,
): number | null {
  if (course.selectionMode !== "split") return null;
  if (course.options.length === 0) return null;
  if (!course.required) return null;
  return Math.max(0, Math.trunc(partySize));
}

export function findEventMenuCourseIssues(
  menu: Pick<EventMenu, "courses">,
  selection: EventMenuSelection,
  partySize: number,
): EventMenuCourseIssue[] {
  const issues: EventMenuCourseIssue[] = [];
  for (const course of menu.courses) {
    if (course.selectionMode !== "split" || course.options.length === 0) continue;
    const assigned = courseAssignedCount(course, selection);
    if (assigned > partySize) {
      issues.push({
        courseId: course.id,
        expected: course.required ? Math.max(0, Math.trunc(partySize)) : partySize,
        assigned,
      });
      continue;
    }
    const expected = splitCourseExpectedCount(course, partySize);
    if (expected == null) continue;
    if (assigned !== expected) {
      issues.push({ courseId: course.id, expected, assigned });
    }
  }
  return issues;
}

export function findEventMenuWishWarnings(
  menu: Pick<EventMenu, "courses">,
  selection: EventMenuSelection,
): EventMenuDietKey[] {
  const warnings: EventMenuDietKey[] = [];
  const diets: EventMenuDietKey[] = [
    "vegan",
    "vegetarian",
    "gluten_free",
    "lactose_free",
    "no_pork",
    "kids",
  ];
  const splitCourses = menu.courses.filter(
    (course) => course.selectionMode === "split" && course.options.length > 0,
  );
  if (splitCourses.length === 0) return warnings;
  for (const diet of diets) {
    const wanted = selection.wishes[diet];
    if (wanted <= 0) continue;
    const hasMatchingOption = splitCourses.some((course) =>
      course.options.some((option) => optionMatchesDiet(option, diet)),
    );
    if (!hasMatchingOption) continue;
    const uncovered = splitCourses.some((course) => {
      if (!course.options.some((option) => optionMatchesDiet(option, diet))) {
        return false;
      }
      return courseDietAssignedCount(course, selection, diet) < wanted;
    });
    if (uncovered) warnings.push(diet);
  }
  return warnings;
}

export function suggestSplitCourseCounts(
  course: EventMenuCourse,
  partySize: number,
  wishes: EventMenuWishes,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const option of course.options) counts[option.id] = 0;
  if (course.selectionMode !== "split" || course.options.length === 0) {
    return counts;
  }
  const { adults, kids } = eventMenuAdultAndKidsCount(partySize, wishes);
  let remainingKids = kids;
  let remainingAdults = adults;

  const kidsOptions = course.options.filter((option) => option.diets.includes("kids"));
  if (kidsOptions.length === 1) {
    counts[kidsOptions[0]!.id] = remainingKids;
    remainingKids = 0;
  } else if (kidsOptions.length > 1 && remainingKids > 0) {
    counts[kidsOptions[0]!.id] = remainingKids;
    remainingKids = 0;
  }

  const take = (diet: EventMenuDietKey, amount: number) => {
    if (amount <= 0 || remainingAdults <= 0) return;
    const matches = course.options.filter(
      (option) => !option.diets.includes("kids") && optionMatchesDiet(option, diet),
    );
    if (matches.length === 0) return;
    const n = Math.min(amount, remainingAdults);
    counts[matches[0]!.id] = (counts[matches[0]!.id] ?? 0) + n;
    remainingAdults -= n;
  };

  take("vegan", wishes.vegan);
  take("vegetarian", Math.max(0, wishes.vegetarian - wishes.vegan));
  take("gluten_free", wishes.gluten_free);
  take("lactose_free", wishes.lactose_free);
  take("no_pork", wishes.no_pork);

  if (remainingAdults > 0 || remainingKids > 0) {
    const fallback =
      course.options.find((option) => !option.diets.includes("kids")) ??
      course.options[0];
    if (fallback) {
      counts[fallback.id] =
        (counts[fallback.id] ?? 0) + remainingAdults + remainingKids;
    }
  }
  const target = Math.max(0, Math.trunc(partySize));
  let sum = Object.values(counts).reduce((total, n) => total + n, 0);
  if (sum > target) {
    for (let i = course.options.length - 1; i >= 0 && sum > target; i--) {
      const id = course.options[i]!.id;
      const take = Math.min(counts[id] ?? 0, sum - target);
      counts[id] = (counts[id] ?? 0) - take;
      sum -= take;
    }
  }
  return counts;
}

function addonMaxCount(
  addon: EventMenuAddon,
  partySize: number,
  wishes: Pick<EventMenuWishes, "kids">,
): number {
  if (addon.billing === "flat") return 1;
  const { adults, kids } = eventMenuAdultAndKidsCount(partySize, wishes);
  return addon.excludeKids ? adults : adults + kids;
}

export function clampAddonCount(
  addon: EventMenuAddon,
  count: number,
  partySize: number,
  wishes: Pick<EventMenuWishes, "kids">,
): number {
  const max = addonMaxCount(addon, partySize, wishes);
  const n = Number.isFinite(count) ? Math.trunc(count) : 0;
  return Math.min(max, Math.max(0, n));
}

export function eventMenuQuoteLines(
  menu: Pick<
    EventMenu,
    "name" | "description" | "pricePerPerson" | "kidsPricePerPerson" | "courses" | "addons"
  >,
  selection: EventMenuSelection,
  partySize: number,
): EventMenuQuoteLine[] {
  const { adults, kids } = eventMenuAdultAndKidsCount(partySize, selection.wishes);
  const kidsPrice = menu.kidsPricePerPerson ?? menu.pricePerPerson;
  const lines: EventMenuQuoteLine[] = [];

  if (adults > 0) {
    lines.push({
      name: kids > 0 ? `${menu.name} (Erwachsene)` : menu.name,
      description: menu.description || null,
      quantity: adults,
      unitName: "Person",
      unitPrice: menu.pricePerPerson,
    });
  }
  if (kids > 0) {
    lines.push({
      name: `${menu.name} (Kinder)`,
      description: menu.description || null,
      quantity: kids,
      unitName: "Person",
      unitPrice: kidsPrice,
    });
  }

  for (const course of menu.courses) {
    if (course.selectionMode !== "split") continue;
    for (const option of course.options) {
      const count = optionCount(selection, course.id, option.id);
      if (count <= 0 || option.extraPricePerPerson <= 0) continue;
      lines.push({
        name: `${course.name}: ${option.name}`,
        description: "Aufpreis",
        quantity: count,
        unitName: "Person",
        unitPrice: option.extraPricePerPerson,
      });
    }
  }

  for (const addon of menu.addons) {
    const count = clampAddonCount(
      addon,
      selection.addonCounts[addon.id] ?? 0,
      partySize,
      selection.wishes,
    );
    if (count <= 0 || addon.price <= 0) continue;
    lines.push({
      name: addon.name,
      description: addon.description || null,
      quantity: count,
      unitName: addon.billing === "flat" ? "pauschal" : "Person",
      unitPrice: addon.price,
    });
  }

  return lines;
}

export function eventMenuEstimateTotal(
  menu: Pick<
    EventMenu,
    "pricePerPerson" | "kidsPricePerPerson" | "courses" | "addons"
  >,
  selection: EventMenuSelection,
  partySize: number,
): number {
  const total = eventMenuQuoteLines(menu, selection, partySize).reduce(
    (sum, line) => sum + line.quantity * line.unitPrice,
    0,
  );
  return Math.round(total * 100) / 100;
}

export function formatEventMenuNotes(
  menu: Pick<EventMenu, "name" | "courses" | "addons">,
  selection: EventMenuSelection,
  partySize: number,
): string {
  const { adults, kids } = eventMenuAdultAndKidsCount(partySize, selection.wishes);
  const lines: string[] = [`Menü: ${menu.name} (${adults} Erw.${kids ? ` / ${kids} Kind.` : ""})`];

  const wishParts = EVENT_MENU_DIET_KEYS.filter((key) => selection.wishes[key] > 0).map(
    (key) => `${selection.wishes[key]}× ${EVENT_MENU_DIET_LABELS[key]}`,
  );
  if (wishParts.length > 0) {
    lines.push(`Wünsche: ${wishParts.join(", ")}`);
  }

  for (const course of menu.courses) {
    if (course.selectionMode === "fixed") {
      const names = course.options.map((option) => option.name).filter(Boolean);
      if (names.length > 0) {
        lines.push(`${course.name} (inkl.): ${names.join(", ")}`);
      }
      continue;
    }
    const parts = course.options
      .map((option) => {
        const count = optionCount(selection, course.id, option.id);
        return count > 0 ? `${count}× ${option.name}` : null;
      })
      .filter((part): part is string => Boolean(part));
    if (parts.length > 0) {
      lines.push(`${course.name}: ${parts.join(", ")}`);
    }
  }

  const addonParts = menu.addons
    .map((addon) => {
      const count = clampAddonCount(
        addon,
        selection.addonCounts[addon.id] ?? 0,
        partySize,
        selection.wishes,
      );
      return count > 0 ? `${count}× ${addon.name}` : null;
    })
    .filter((part): part is string => Boolean(part));
  if (addonParts.length > 0) {
    lines.push(`Optionen: ${addonParts.join(", ")}`);
  }

  return lines.join("\n");
}

function parseDiets(raw: unknown): EventMenuDietKey[] {
  if (!Array.isArray(raw)) return [];
  const out: EventMenuDietKey[] = [];
  for (const value of raw) {
    if (typeof value !== "string" || !isEventMenuDietKey(value)) continue;
    if (!out.includes(value)) out.push(value);
  }
  return out;
}

function parsePartyBound(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(200, Math.max(1, Math.trunc(n)));
}

function parseOptionalPartyBound(value: unknown): number | null {
  if (value == null || value === "") return null;
  return parsePartyBound(value, 1);
}

function parseCourseOption(
  raw: Record<string, unknown>,
  sortOrder: number,
): EventMenuCourseOption | null {
  const id = typeof raw.id === "string" && isEventMenuId(raw.id) ? raw.id : "";
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!id || !name || name.length > 120) return null;
  const description =
    typeof raw.description === "string" ? raw.description.trim() : "";
  if (description.length > 400) return null;
  const extraPricePerPerson = parseEventPackageMoney(
    raw.extraPricePerPerson ?? raw.extra_price_per_person,
  );
  if (extraPricePerPerson < 0 || extraPricePerPerson > 9999.99) return null;
  return {
    id,
    name,
    description,
    extraPricePerPerson,
    diets: parseDiets(raw.diets),
    sortOrder,
  };
}

function parseCourse(
  raw: Record<string, unknown>,
  sortOrder: number,
): EventMenuCourse | null {
  const id = typeof raw.id === "string" && isEventMenuId(raw.id) ? raw.id : "";
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!id || !name || name.length > 80) return null;
  const modeRaw =
    typeof raw.selectionMode === "string"
      ? raw.selectionMode
      : typeof raw.selection_mode === "string"
        ? raw.selection_mode
        : "split";
  if (!isEventMenuCourseMode(modeRaw)) return null;
  const optionsRaw = Array.isArray(raw.options) ? raw.options : [];
  if (optionsRaw.length > EVENT_MENU_MAX_OPTIONS_PER_COURSE) return null;
  const options: EventMenuCourseOption[] = [];
  for (let i = 0; i < optionsRaw.length; i++) {
    const item = optionsRaw[i];
    if (!item || typeof item !== "object") return null;
    const parsed = parseCourseOption(item as Record<string, unknown>, i);
    if (!parsed) return null;
    options.push(parsed);
  }
  return {
    id,
    name,
    selectionMode: modeRaw,
    required: raw.required !== false,
    sortOrder,
    options,
  };
}

function parseAddon(
  raw: Record<string, unknown>,
  sortOrder: number,
): EventMenuAddon | null {
  const id = typeof raw.id === "string" && isEventMenuId(raw.id) ? raw.id : "";
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!id || !name || name.length > 120) return null;
  const description =
    typeof raw.description === "string" ? raw.description.trim() : "";
  if (description.length > 400) return null;
  const price = parseEventPackageMoney(raw.price);
  if (price < 0 || price > 9999.99) return null;
  const billingRaw =
    typeof raw.billing === "string" ? raw.billing : "per_person";
  if (!isEventMenuAddonBilling(billingRaw)) return null;
  return {
    id,
    name,
    description,
    price,
    billing: billingRaw,
    excludeKids: raw.excludeKids === true || raw.exclude_kids === true,
    sortOrder,
  };
}

export function parseEventMenuWriteFields(
  body: Record<string, unknown>,
): { error: string } | { error: null; input: EventMenuWriteFields } {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length < 1 || name.length > 120) return { error: "invalid_name" };
  const description =
    typeof body.description === "string" ? body.description.trim() : "";
  if (description.length > 800) return { error: "invalid_description" };
  const pricePerPerson = parseEventPackageMoney(
    body.pricePerPerson ?? body.price_per_person,
  );
  if (pricePerPerson < 0 || pricePerPerson > 9999.99) return { error: "invalid_price" };
  const kidsRaw = body.kidsPricePerPerson ?? body.kids_price_per_person;
  let kidsPricePerPerson: number | null = null;
  if (kidsRaw != null && kidsRaw !== "") {
    kidsPricePerPerson = parseEventPackageMoney(kidsRaw);
    if (kidsPricePerPerson < 0 || kidsPricePerPerson > 9999.99) {
      return { error: "invalid_kids_price" };
    }
  }
  const taxRatePercent = parseEventPackageMoney(
    body.taxRatePercent ?? body.tax_rate_percent ?? 19,
  );
  if (taxRatePercent < 0 || taxRatePercent > 100) return { error: "invalid_tax_rate" };
  const minPartySize = parsePartyBound(
    body.minPartySize ?? body.min_party_size,
    1,
  );
  const maxPartySize = parseOptionalPartyBound(
    body.maxPartySize ?? body.max_party_size,
  );
  if (maxPartySize != null && maxPartySize < minPartySize) {
    return { error: "invalid_party_range" };
  }
  const coursesRaw = Array.isArray(body.courses) ? body.courses : [];
  if (coursesRaw.length > EVENT_MENU_MAX_COURSES) return { error: "invalid_courses" };
  const courses: EventMenuCourse[] = [];
  for (let i = 0; i < coursesRaw.length; i++) {
    const item = coursesRaw[i];
    if (!item || typeof item !== "object") return { error: "invalid_courses" };
    const parsed = parseCourse(item as Record<string, unknown>, i);
    if (!parsed) return { error: "invalid_courses" };
    courses.push(parsed);
  }
  const addonsRaw = Array.isArray(body.addons) ? body.addons : [];
  if (addonsRaw.length > EVENT_MENU_MAX_ADDONS) return { error: "invalid_addons" };
  const addons: EventMenuAddon[] = [];
  for (let i = 0; i < addonsRaw.length; i++) {
    const item = addonsRaw[i];
    if (!item || typeof item !== "object") return { error: "invalid_addons" };
    const parsed = parseAddon(item as Record<string, unknown>, i);
    if (!parsed) return { error: "invalid_addons" };
    addons.push(parsed);
  }
  const sortOrder = Number.isFinite(Number(body.sortOrder ?? body.sort_order))
    ? Math.trunc(Number(body.sortOrder ?? body.sort_order))
    : 0;
  return {
    error: null,
    input: {
      name,
      description,
      pricePerPerson,
      kidsPricePerPerson,
      taxRatePercent,
      minPartySize,
      maxPartySize,
      active: body.active !== false,
      sortOrder,
      courses,
      addons,
    },
  };
}

export function parseEventMenuWishes(
  raw: unknown,
  partySize: number,
): EventMenuWishes {
  const source =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const read = (key: EventMenuDietKey) => {
    const n = Number(source[key]);
    return Number.isFinite(n) ? n : 0;
  };
  return clampEventMenuWishes(
    {
      vegetarian: read("vegetarian"),
      vegan: read("vegan"),
      gluten_free: read("gluten_free"),
      lactose_free: read("lactose_free"),
      no_pork: read("no_pork"),
      kids: read("kids"),
    },
    partySize,
  );
}

export function parseGuestEventMenuSelection(
  raw: unknown,
  menu: PublicEventMenu | EventMenu,
  partySize: number,
): { error: string } | { error: null; selection: EventMenuSelection } {
  const body =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const wishes = parseEventMenuWishes(body.wishes, partySize);
  const courseCountsRaw =
    body.courseCounts && typeof body.courseCounts === "object"
      ? (body.courseCounts as Record<string, unknown>)
      : body.course_counts && typeof body.course_counts === "object"
        ? (body.course_counts as Record<string, unknown>)
        : {};
  const addonCountsRaw =
    body.addonCounts && typeof body.addonCounts === "object"
      ? (body.addonCounts as Record<string, unknown>)
      : body.addon_counts && typeof body.addon_counts === "object"
        ? (body.addon_counts as Record<string, unknown>)
        : {};

  const courseCounts: Record<string, Record<string, number>> = {};
  const knownCourseIds = new Set(menu.courses.map((course) => course.id));
  const knownOptionIds = new Set(
    menu.courses.flatMap((course) => course.options.map((option) => option.id)),
  );
  for (const [courseId, optionsRaw] of Object.entries(courseCountsRaw)) {
    if (!knownCourseIds.has(courseId)) return { error: "invalid_menu" };
    if (!optionsRaw || typeof optionsRaw !== "object") return { error: "invalid_menu" };
    const counts: Record<string, number> = {};
    for (const [optionId, value] of Object.entries(
      optionsRaw as Record<string, unknown>,
    )) {
      if (!knownOptionIds.has(optionId)) return { error: "invalid_menu" };
      const n = Number(value);
      if (!Number.isFinite(n) || n < 0 || n > 200) return { error: "invalid_menu" };
      counts[optionId] = Math.trunc(n);
    }
    courseCounts[courseId] = counts;
  }

  const addonCounts: Record<string, number> = {};
  const addonById = new Map(menu.addons.map((addon) => [addon.id, addon]));
  for (const [addonId, value] of Object.entries(addonCountsRaw)) {
    const addon = addonById.get(addonId);
    if (!addon) return { error: "invalid_menu" };
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0 || n > 200) return { error: "invalid_menu" };
    addonCounts[addonId] = clampAddonCount(addon, n, partySize, wishes);
  }

  const selection: EventMenuSelection = {
    menuId: menu.id,
    courseCounts,
    addonCounts,
    wishes,
  };
  if (!eventMenuFitsPartySize(menu, partySize)) return { error: "invalid_menu" };
  if (findEventMenuCourseIssues(menu, selection, partySize).length > 0) {
    return { error: "invalid_menu" };
  }
  return { error: null, selection };
}

export function toPublicEventMenu(menu: EventMenu): PublicEventMenu {
  return {
    id: menu.id,
    name: menu.name,
    description: menu.description,
    pricePerPerson: menu.pricePerPerson,
    kidsPricePerPerson: menu.kidsPricePerPerson,
    minPartySize: menu.minPartySize,
    maxPartySize: menu.maxPartySize,
    courses: menu.courses,
    addons: menu.addons,
  };
}

export function newEventMenuEntityId(): string {
  return crypto.randomUUID();
}

export function defaultEventMenuCourses(): EventMenuCourse[] {
  return [
    {
      id: newEventMenuEntityId(),
      name: "Vorspeise",
      selectionMode: "split",
      required: true,
      sortOrder: 0,
      options: [],
    },
    {
      id: newEventMenuEntityId(),
      name: "Hauptgang",
      selectionMode: "split",
      required: true,
      sortOrder: 1,
      options: [],
    },
    {
      id: newEventMenuEntityId(),
      name: "Dessert",
      selectionMode: "split",
      required: true,
      sortOrder: 2,
      options: [],
    },
  ];
}

export function emptyEventMenuOption(): EventMenuCourseOption {
  return {
    id: newEventMenuEntityId(),
    name: "",
    description: "",
    extraPricePerPerson: 0,
    diets: [],
    sortOrder: 0,
  };
}

export function emptyEventMenuAddon(): EventMenuAddon {
  return {
    id: newEventMenuEntityId(),
    name: "",
    description: "",
    price: 0,
    billing: "per_person",
    excludeKids: false,
    sortOrder: 0,
  };
}

export function emptyEventMenuCourse(name = "Gang"): EventMenuCourse {
  return {
    id: newEventMenuEntityId(),
    name,
    selectionMode: "split",
    required: true,
    sortOrder: 0,
    options: [],
  };
}
