import assert from "node:assert/strict";
import test from "node:test";
import { bagExpectedCents, cashSaleIdempotencyKey } from "./cash-bags.service";

test("bagExpectedCents = opening + sales - drops", () => {
  assert.equal(
    bagExpectedCents({
      openingFloatCents: 10_000,
      movements: [
        { kind: "float_out", amount_cents: 10_000 },
        { kind: "cash_sale", amount_cents: 5_000 },
        { kind: "drop_in", amount_cents: 2_000 },
      ],
    }),
    13_000,
  );
});

test("cashSaleIdempotencyKey prefers client attempt", () => {
  assert.equal(cashSaleIdempotencyKey("pay-1", "attempt-9"), "cash_sale:attempt-9");
  assert.equal(cashSaleIdempotencyKey("pay-1", null), "cash_sale:pay-1");
});
