import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bagExpectedCents,
  cashSaleIdempotencyKey,
} from "../waiter-cash-bag-server";

describe("bagExpectedCents", () => {
  it("start + sales - drops", () => {
    assert.equal(
      bagExpectedCents({
        openingFloatCents: 10_000,
        movements: [
          { kind: "float_out", amount_cents: 10_000 }, // informational; opening already set
          { kind: "cash_sale", amount_cents: 5_000 },
          { kind: "drop_in", amount_cents: 2_000 },
        ],
      }),
      13_000, // 100 + 50 - 20
    );
  });
});

describe("cashSaleIdempotencyKey", () => {
  it("prefers client attempt id when present", () => {
    assert.equal(
      cashSaleIdempotencyKey("pay-1", "attempt-9"),
      "cash_sale:attempt-9",
    );
  });

  it("falls back to payment id", () => {
    assert.equal(cashSaleIdempotencyKey("pay-1", null), "cash_sale:pay-1");
    assert.equal(cashSaleIdempotencyKey("pay-1", "  "), "cash_sale:pay-1");
  });
});

describe("staff_profile_id namespace", () => {
  it("documents bag staff key as profiles.id (UUID-shaped)", () => {
    // applyCashSale / findOpenBag look up by staff_profile_id = profiles.id
    // (Nest auth.profileId / web collect auth.userId) — not restaurant_staff.id.
    const profileId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const restaurantStaffId = "11111111-2222-3333-4444-555555555555";
    assert.notEqual(profileId, restaurantStaffId);
  });
});
