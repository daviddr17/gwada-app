import { describe, expect, it } from "vitest";
import {
  bagExpectedCents,
  cashSaleIdempotencyKey,
} from "../waiter-cash-bag-server";

describe("bagExpectedCents", () => {
  it("start + sales - drops", () => {
    expect(
      bagExpectedCents({
        openingFloatCents: 10_000,
        movements: [
          { kind: "float_out", amount_cents: 10_000 }, // informational; opening already set
          { kind: "cash_sale", amount_cents: 5_000 },
          { kind: "drop_in", amount_cents: 2_000 },
        ],
      }),
    ).toBe(13_000); // 100 + 50 - 20
  });
});

describe("cashSaleIdempotencyKey", () => {
  it("prefers client attempt id when present", () => {
    expect(cashSaleIdempotencyKey("pay-1", "attempt-9")).toBe(
      "cash_sale:attempt-9",
    );
  });

  it("falls back to payment id", () => {
    expect(cashSaleIdempotencyKey("pay-1", null)).toBe("cash_sale:pay-1");
    expect(cashSaleIdempotencyKey("pay-1", "  ")).toBe("cash_sale:pay-1");
  });
});

describe("staff_profile_id namespace", () => {
  it("documents bag staff key as profiles.id (UUID-shaped)", () => {
    // applyCashSale / findOpenBag look up by staff_profile_id = profiles.id
    // (Nest auth.profileId / web collect auth.userId) — not restaurant_staff.id.
    const profileId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const restaurantStaffId = "11111111-2222-3333-4444-555555555555";
    expect(profileId).not.toBe(restaurantStaffId);
    expect(profileId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });
});
