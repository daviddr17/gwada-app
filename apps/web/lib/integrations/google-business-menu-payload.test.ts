import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildGoogleFoodMenusBody,
  googleFoodMenuErrorCode,
  priceToGoogleMoney,
  selectGoogleMenuSections,
  type GoogleMenuCategoryCandidate,
  type GoogleMenuItemCandidate,
} from "@/lib/integrations/google-business-menu-payload";

const NOW = new Date("2026-09-19T10:00:00Z");
const TZ = "UTC";

function item(
  overrides: Partial<GoogleMenuItemCandidate> = {},
): GoogleMenuItemCandidate {
  return {
    id: "item-1",
    name: "Schnitzel",
    description: "Mit Pommes",
    price: 12.99,
    active: true,
    categoryId: "cat-food",
    availableFrom: null,
    availableTo: null,
    ...overrides,
  };
}

function category(
  overrides: Partial<GoogleMenuCategoryCandidate> = {},
): GoogleMenuCategoryCandidate {
  return {
    id: "cat-food",
    name: "Hauptgerichte",
    active: true,
    sortOrder: 1,
    mainCategoryId: "main-food",
    mainActive: true,
    mainSortOrder: 0,
    ...overrides,
  };
}

test("selectGoogleMenuSections keeps only active dishes in active categories", () => {
  const sections = selectGoogleMenuSections(
    [
      item(),
      item({ id: "off", name: "Aus", active: false }),
      item({ id: "old", name: "Gestern", availableTo: "2026-09-18" }),
      item({ id: "soon", name: "Morgen", availableFrom: "2026-09-20" }),
      item({
        id: "hidden-cat",
        name: "Archivgericht",
        categoryId: "cat-hidden",
      }),
      item({
        id: "hidden-main",
        name: "Getränk",
        categoryId: "cat-drinks",
      }),
      item({ id: "blank", name: "   ", categoryId: "cat-food" }),
    ],
    [
      category(),
      category({
        id: "cat-hidden",
        name: "Archiv",
        active: false,
      }),
      category({
        id: "cat-drinks",
        name: "Getränke",
        mainCategoryId: "main-drinks",
        mainActive: false,
        mainSortOrder: 1,
        sortOrder: 0,
      }),
    ],
    NOW,
    TZ,
  );

  assert.deepEqual(
    sections.map((section) => section.items.map((entry) => entry.name)),
    [["Schnitzel"]],
  );
});

test("selectGoogleMenuSections orders sections by main category then category", () => {
  const sections = selectGoogleMenuSections(
    [
      item({ id: "a", name: "Cola", categoryId: "drinks" }),
      item({ id: "b", name: "Suppe", categoryId: "starter" }),
      item({ id: "c", name: "Steak", categoryId: "main" }),
    ],
    [
      category({
        id: "drinks",
        name: "Getränke",
        mainCategoryId: "bev",
        mainSortOrder: 1,
        sortOrder: 0,
      }),
      category({
        id: "main",
        name: "Hauptgerichte",
        sortOrder: 2,
      }),
      category({
        id: "starter",
        name: "Vorspeisen",
        sortOrder: 1,
      }),
    ],
    NOW,
    TZ,
  );

  assert.deepEqual(
    sections.map((section) => section.title),
    ["Vorspeisen", "Hauptgerichte", "Getränke"],
  );
});

test("buildGoogleFoodMenusBody puts the description on the label", () => {
  const body = buildGoogleFoodMenusBody({
    resourceName: "accounts/1/locations/2/foodMenus",
    currencyCode: "EUR",
    sections: [
      {
        title: "Hauptgerichte",
        mainSortOrder: 0,
        sortOrder: 0,
        items: [{ name: "Schnitzel", description: "Mit Pommes", price: 12.99 }],
      },
    ],
  });

  const dish = body.menus[0]?.sections[0]?.items[0];
  assert.equal(body.name, "accounts/1/locations/2/foodMenus");
  assert.equal(dish?.labels[0]?.description, "Mit Pommes");
  assert.equal("description" in (dish ?? {}), false);
  assert.deepEqual(dish?.attributes.price, {
    currencyCode: "EUR",
    units: "12",
    nanos: 990_000_000,
  });
});

test("priceToGoogleMoney uses whole units for zero-decimal currencies", () => {
  assert.deepEqual(priceToGoogleMoney(1200.6, "JPY"), {
    currencyCode: "JPY",
    units: "1201",
    nanos: 0,
  });
});

test("selectGoogleMenuSections clips labels to Google limits", () => {
  const sections = selectGoogleMenuSections(
    [
      item({
        name: "A".repeat(180),
        description: "B".repeat(1200),
      }),
    ],
    [category()],
    NOW,
    TZ,
  );
  const dish = sections[0]?.items[0];
  assert.equal(dish?.name.length, 140);
  assert.equal(dish?.description.length, 1000);
});

test("googleFoodMenuErrorCode maps ineligible locations", () => {
  assert.equal(
    googleFoodMenuErrorCode(
      400,
      "This location is not eligible for food menus.",
    ),
    "google_food_menu_unsupported",
  );
  assert.match(googleFoodMenuErrorCode(400, "Request contains an invalid argument."), /^google_/);
});
