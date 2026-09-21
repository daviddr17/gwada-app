import { isMenuItemPubliclyAvailable } from "@/lib/menu/item-utils";

const GOOGLE_MENU_LABEL_MAX = 140;
const GOOGLE_MENU_DESCRIPTION_MAX = 1000;

const ZERO_DECIMAL_CURRENCIES = new Set(["JPY", "KRW", "VND", "XPF"]);

export type GoogleMenuItemCandidate = {
  id: string;
  name: string;
  description: string;
  price: number;
  active: boolean;
  categoryId: string;
  availableFrom: string | null;
  availableTo: string | null;
};

export type GoogleMenuCategoryCandidate = {
  id: string;
  name: string;
  active: boolean;
  sortOrder: number;
  mainCategoryId: string;
  mainActive: boolean;
  mainSortOrder: number;
};

export type GoogleFoodMenuSection = {
  title: string;
  mainSortOrder: number;
  sortOrder: number;
  items: Array<{ name: string; description: string; price: number }>;
};

function clipChars(value: string, max: number): string {
  const chars = [...value];
  if (chars.length <= max) return value;
  return chars.slice(0, max).join("").trimEnd();
}

export function clipGoogleMenuLabel(value: string): string {
  return clipChars(value.replace(/\s+/g, " ").trim(), GOOGLE_MENU_LABEL_MAX);
}

export function clipGoogleMenuDescription(value: string): string {
  return clipChars(value.trim(), GOOGLE_MENU_DESCRIPTION_MAX);
}

/** Google Money: `units` ist der Ganzzahlteil, `nanos` der Bruchteil in 1e-9. */
export function priceToGoogleMoney(
  price: number,
  currencyCode: string,
): { currencyCode: string; units: string; nanos: number } {
  const safe = Math.max(0, Number.isFinite(price) ? price : 0);
  if (ZERO_DECIMAL_CURRENCIES.has(currencyCode)) {
    return { currencyCode, units: String(Math.round(safe)), nanos: 0 };
  }
  const cents = Math.round(safe * 100);
  const units = Math.trunc(cents / 100);
  const nanos = (cents % 100) * 10_000_000;
  return { currencyCode, units: String(units), nanos };
}

/**
 * Nur Gerichte, die Gäste sehen: aktiv, im Anzeigezeitraum, Kategorie aktiv,
 * Hauptkategorie aktiv.
 */
export function selectGoogleMenuSections(
  items: GoogleMenuItemCandidate[],
  categories: GoogleMenuCategoryCandidate[],
  now: Date,
  timeZone: string,
): GoogleFoodMenuSection[] {
  const categoryById = new Map<string, GoogleMenuCategoryCandidate>();
  for (const category of categories) {
    if (!category.active || !category.mainActive) continue;
    categoryById.set(category.id, category);
  }

  const sections = new Map<string, GoogleFoodMenuSection>();
  for (const item of items) {
    const category = categoryById.get(item.categoryId);
    if (!category) continue;
    const name = clipGoogleMenuLabel(item.name);
    if (!name) continue;
    if (
      !isMenuItemPubliclyAvailable(
        {
          id: item.id,
          name,
          description: item.description,
          price: item.price,
          category: item.categoryId,
          imageUrl: "",
          tags: [],
          active: item.active,
          availableFrom: item.availableFrom,
          availableTo: item.availableTo,
        },
        now,
        timeZone,
      )
    ) {
      continue;
    }

    const existing = sections.get(category.id);
    const entry = {
      name,
      description: clipGoogleMenuDescription(item.description),
      price: item.price,
    };
    if (existing) {
      existing.items.push(entry);
    } else {
      sections.set(category.id, {
        title: clipGoogleMenuLabel(category.name) || "Speisekarte",
        mainSortOrder: category.mainSortOrder,
        sortOrder: category.sortOrder,
        items: [entry],
      });
    }
  }

  return [...sections.values()].sort(
    (a, b) =>
      a.mainSortOrder - b.mainSortOrder ||
      a.sortOrder - b.sortOrder ||
      a.title.localeCompare(b.title, "de"),
  );
}

type GoogleMenuLabel = {
  displayName: string;
  languageCode: "de";
  description?: string;
};

function menuLabel(displayName: string, description?: string): GoogleMenuLabel {
  const label: GoogleMenuLabel = { displayName, languageCode: "de" };
  const text = description?.trim();
  if (text) label.description = text;
  return label;
}

export function buildGoogleFoodMenusBody(input: {
  resourceName: string;
  currencyCode: string;
  sections: GoogleFoodMenuSection[];
}): {
  name: string;
  menus: Array<{
    labels: GoogleMenuLabel[];
    sections: Array<{
      labels: GoogleMenuLabel[];
      items: Array<{
        labels: GoogleMenuLabel[];
        attributes: {
          price: { currencyCode: string; units: string; nanos: number };
        };
      }>;
    }>;
  }>;
} {
  return {
    name: input.resourceName,
    menus: [
      {
        labels: [menuLabel("Speisekarte")],
        sections: input.sections.map((section) => ({
          labels: [menuLabel(section.title)],
          items: section.items.map((item) => ({
            labels: [menuLabel(item.name, item.description)],
            attributes: {
              price: priceToGoogleMoney(item.price, input.currencyCode),
            },
          })),
        })),
      },
    ],
  };
}

export function googleFoodMenusResourceName(parent: string): string {
  const trimmed = parent.replace(/\/+$/, "");
  return trimmed.endsWith("/foodMenus") ? trimmed : `${trimmed}/foodMenus`;
}

/** Stabile Fehlercodes für die Speisekarten-Schaltfläche. */
export function googleFoodMenuErrorCode(status: number, message: string): string {
  const text = message.toLowerCase();
  if (
    text.includes("can_have_food_menu") ||
    text.includes("canhavefoodmenu") ||
    text.includes("not eligible for food") ||
    (text.includes("food menu") &&
      (text.includes("not supported") ||
        text.includes("cannot") ||
        text.includes("can't") ||
        text.includes("ineligible")))
  ) {
    return "google_food_menu_unsupported";
  }
  const trimmed = message.replace(/\s+/g, " ").trim();
  if (!trimmed) return `google_menu_${status}`;
  return `google_${trimmed.slice(0, 220)}`;
}
