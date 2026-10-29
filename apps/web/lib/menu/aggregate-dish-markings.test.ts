import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  aggregateDishMarkingCodes,
  markingCodesFromRecipeIngredients,
} from "@/lib/menu/aggregate-dish-markings";
import {
  foodMarkingsForCountry,
  normalizeFoodMarkingCodes,
} from "@/lib/menu/food-marking-catalog";

describe("food marking catalog", () => {
  it("DE list includes additives and EU allergens", () => {
    const list = foodMarkingsForCountry("DE");
    assert.ok(list.some((m) => m.code === "a" && m.kind === "additive"));
    assert.ok(list.some((m) => m.code === "1" && m.kind === "allergen"));
    assert.ok(list.some((m) => m.code === "14"));
  });

  it("normalizes and drops unknown codes when country set", () => {
    assert.deepEqual(
      normalizeFoodMarkingCodes(["a", "zzz", "1", "a"], "DE"),
      ["a", "1"],
    );
  });
});

describe("aggregateDishMarkingCodes", () => {
  it("unions dish codes with recipe ingredient codes", () => {
    const ingredientsById = new Map([
      ["ing-1", { markingCodes: ["a", "7"] }],
      ["ing-2", { markingCodes: ["1", "a"] }],
    ]);
    const codes = aggregateDishMarkingCodes({
      dishCodes: ["d"],
      recipe: [
        { ingredientId: "ing-1", amount: 10 },
        { ingredientId: "ing-2", amount: 5 },
      ],
      ingredientsById,
      countryIso2: "DE",
    });
    assert.deepEqual(codes, ["a", "d", "1", "7"]);
  });

  it("recipe-only helper ignores dish codes", () => {
    const ingredientsById = new Map([["ing-1", { markingCodes: ["b"] }]]);
    assert.deepEqual(
      markingCodesFromRecipeIngredients({
        recipe: [{ ingredientId: "ing-1", amount: 1 }],
        ingredientsById,
        countryIso2: "DE",
      }),
      ["b"],
    );
  });
});
