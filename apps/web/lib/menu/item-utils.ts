import type {
  MenuCategoryDefinition,
  MenuItem,
  MenuMainCategoryDefinition,
} from "@/lib/types/menu";
import { normalizeRecipeLines } from "@/lib/menu/recipe-utils";
import {
  DEFAULT_RESTAURANT_TIMEZONE,
  restaurantZonedDateKey,
} from "@/lib/restaurant/restaurant-timezone";

function menuAvailabilityYmd(
  onDate: Date,
  timeZone: string = DEFAULT_RESTAURANT_TIMEZONE,
): string {
  return restaurantZonedDateKey(onDate, timeZone);
}

export function normalizeMenuAvailabilityYmd(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

export function menuItemHasAvailabilityWindow(
  item: Pick<MenuItem, "availableFrom" | "availableTo">,
): boolean {
  return Boolean(
    normalizeMenuAvailabilityYmd(item.availableFrom) ||
      normalizeMenuAvailabilityYmd(item.availableTo),
  );
}

export function isMenuItemWithinAvailabilityWindow(
  item: Pick<MenuItem, "availableFrom" | "availableTo">,
  onDate: Date = new Date(),
  timeZone: string = DEFAULT_RESTAURANT_TIMEZONE,
): boolean {
  const ymd = menuAvailabilityYmd(onDate, timeZone);
  const from = normalizeMenuAvailabilityYmd(item.availableFrom);
  const to = normalizeMenuAvailabilityYmd(item.availableTo);
  if (!from && !to) return true;
  if (from && ymd < from) return false;
  if (to && ymd > to) return false;
  return true;
}

export function isMenuItemActive(item: MenuItem): boolean {
  return item.active !== false;
}

/** Aktiv-Schalter + optionaler Anzeigezeitraum (für Gäste/POS). */
export function isMenuItemPubliclyAvailable(
  item: MenuItem,
  onDate: Date = new Date(),
  timeZone: string = DEFAULT_RESTAURANT_TIMEZONE,
): boolean {
  return (
    isMenuItemActive(item) &&
    isMenuItemWithinAvailabilityWindow(item, onDate, timeZone)
  );
}

export type MenuItemAvailabilityPhase = "upcoming" | "active" | "expired";

export function menuItemAvailabilityPhase(
  item: Pick<MenuItem, "availableFrom" | "availableTo">,
  onDate: Date = new Date(),
  timeZone: string = DEFAULT_RESTAURANT_TIMEZONE,
): MenuItemAvailabilityPhase | null {
  if (!menuItemHasAvailabilityWindow(item)) return null;
  const ymd = menuAvailabilityYmd(onDate, timeZone);
  const from = normalizeMenuAvailabilityYmd(item.availableFrom);
  const to = normalizeMenuAvailabilityYmd(item.availableTo);
  if (from && ymd < from) return "upcoming";
  if (to && ymd > to) return "expired";
  return "active";
}

const menuAvailabilityDateDe = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function formatMenuAvailabilityYmdDe(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  return menuAvailabilityDateDe.format(new Date(y, m - 1, d));
}

export function formatMenuItemAvailabilityRangeDe(
  from: string | null | undefined,
  to: string | null | undefined,
): string {
  const f = normalizeMenuAvailabilityYmd(from);
  const t = normalizeMenuAvailabilityYmd(to);
  if (f && t) {
    if (f === t) return formatMenuAvailabilityYmdDe(f);
    if (f.slice(0, 4) === t.slice(0, 4)) {
      return `${f.slice(8, 10)}.${f.slice(5, 7)}.–${formatMenuAvailabilityYmdDe(t)}`;
    }
    return `${formatMenuAvailabilityYmdDe(f)} – ${formatMenuAvailabilityYmdDe(t)}`;
  }
  if (f) return `ab ${formatMenuAvailabilityYmdDe(f)}`;
  if (t) return `bis ${formatMenuAvailabilityYmdDe(t)}`;
  return "";
}

export function isCategoryActive(cat: MenuCategoryDefinition): boolean {
  return cat.active !== false;
}

export function isMainCategoryActive(cat: MenuMainCategoryDefinition): boolean {
  return cat.active !== false;
}

/** Sortierung innerhalb einer Kategorie: Nummer, dann Name. */
export function sortItemsInCategoryForDisplay(items: MenuItem[]): MenuItem[] {
  return [...items].sort((a, b) => {
    const an = a.listNumber;
    const bn = b.listNumber;
    if (an != null && bn != null && an !== bn) return an - bn;
    if (an != null && bn == null) return -1;
    if (an == null && bn != null) return 1;
    return a.name.localeCompare(b.name, "de");
  });
}

export function normalizeMenuItem(
  raw: Record<string, unknown>,
  fallbackId?: string,
): MenuItem | null {
  if (
    typeof raw.name !== "string" ||
    typeof raw.description !== "string" ||
    typeof raw.price !== "number" ||
    typeof raw.category !== "string" ||
    typeof raw.imageUrl !== "string" ||
    !Array.isArray(raw.tags)
  ) {
    return null;
  }
  const id =
    typeof raw.id === "string"
      ? raw.id
      : fallbackId ?? `m-${Date.now().toString(36)}`;
  const listNum = raw.listNumber;
  const recipe = normalizeRecipeLines(raw.recipe);
  const rawTags = Array.isArray(raw.tags)
    ? (raw.tags as unknown[]).filter(
        (t): t is string => typeof t === "string" && t.length > 0,
      )
    : [];
  const optionGroupIds = Array.isArray(raw.optionGroupIds)
    ? (raw.optionGroupIds as unknown[]).filter(
        (t): t is string => typeof t === "string" && t.length > 0,
      )
    : [];
  return {
    id,
    name: raw.name,
    description: raw.description,
    price: raw.price,
    category: raw.category,
    imageUrl: raw.imageUrl,
    tags: rawTags,
    active: raw.active === false ? false : true,
    listNumber:
      typeof listNum === "number" && !Number.isNaN(listNum) ? listNum : null,
    recipe: recipe ?? undefined,
    optionGroupIds,
    availableFrom: normalizeMenuAvailabilityYmd(raw.availableFrom),
    availableTo: normalizeMenuAvailabilityYmd(raw.availableTo),
  };
}
