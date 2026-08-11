import { describe, expect, it } from "vitest";
import { bagExpectedCents } from "../waiter-cash-bag-server";

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
