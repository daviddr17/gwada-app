import assert from "node:assert/strict";
import { test } from "node:test";

import {
  openWageCentsFromSnapshot,
  overpaidCreditCentsFromSnapshot,
  targetHoursForCalendarMonth,
} from "./staff-payroll-settlement.ts";

test("open wage: open status uses due", () => {
  assert.equal(
    openWageCentsFromSnapshot({ dueCents: 12000, settlement: null }),
    12000,
  );
});

test("open wage: paid clears", () => {
  assert.equal(
    openWageCentsFromSnapshot({
      dueCents: 12000,
      settlement: {
        id: "1",
        restaurant_id: "r",
        staff_id: "s",
        period_year: 2026,
        period_month: 8,
        status: "paid",
        amount_cents: 12000,
        note: null,
        paid_at: null,
        created_at: "",
        updated_at: "",
      },
    }),
    0,
  );
});

test("open wage: underpaid uses residual", () => {
  assert.equal(
    openWageCentsFromSnapshot({
      dueCents: 12000,
      settlement: {
        id: "1",
        restaurant_id: "r",
        staff_id: "s",
        period_year: 2026,
        period_month: 8,
        status: "underpaid",
        amount_cents: 4000,
        note: null,
        paid_at: null,
        created_at: "",
        updated_at: "",
      },
    }),
    4000,
  );
});

test("overpaid credit", () => {
  assert.equal(
    overpaidCreditCentsFromSnapshot({
      settlement: {
        id: "1",
        restaurant_id: "r",
        staff_id: "s",
        period_year: 2026,
        period_month: 8,
        status: "overpaid",
        amount_cents: 1500,
        note: null,
        paid_at: null,
        created_at: "",
        updated_at: "",
      },
    }),
    1500,
  );
});

test("target hours for month from weekly soll", () => {
  // 40h/week → Aug 2026 has 31 days → 40 * 31 / 7 ≈ 177.1
  const h = targetHoursForCalendarMonth(40 * 60, 2026, 8);
  assert.ok(h != null && Math.abs(h - 177.1) < 0.05);
});
