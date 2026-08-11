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
