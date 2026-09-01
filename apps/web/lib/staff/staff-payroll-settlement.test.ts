import assert from "node:assert/strict";
import { test } from "node:test";

import {
  derivePayrollSettlement,
  targetHoursForCalendarMonth,
} from "./staff-payroll-settlement.ts";

test("keine Auszahlung → offen, voller Rest", () => {
  const d = derivePayrollSettlement({ wageCents: 12000, payoutCents: 0 });
  assert.equal(d.status, "open");
  assert.equal(d.openCents, 12000);
  assert.equal(d.paidCents, 0);
  assert.equal(d.overpaidCreditCents, 0);
});

test("teilweise ausgezahlt → unterzahlt", () => {
  const d = derivePayrollSettlement({ wageCents: 12000, payoutCents: 4000 });
  assert.equal(d.status, "underpaid");
  assert.equal(d.openCents, 8000);
  assert.equal(d.paidCents, 4000);
});

test("genau ausgezahlt → bezahlt", () => {
  const d = derivePayrollSettlement({ wageCents: 12000, payoutCents: 12000 });
  assert.equal(d.status, "paid");
  assert.equal(d.openCents, 0);
  assert.equal(d.paidCents, 12000);
});

test("mehr ausgezahlt als Lohn → überzahlt", () => {
  const d = derivePayrollSettlement({ wageCents: 10000, payoutCents: 11500 });
  assert.equal(d.status, "overpaid");
  assert.equal(d.openCents, 0);
  assert.equal(d.paidCents, 10000);
  assert.equal(d.overpaidCreditCents, 1500);
});

test("Lohn 0 und Auszahlung 0 → bezahlt (ausgeglichen)", () => {
  const d = derivePayrollSettlement({ wageCents: 0, payoutCents: 0 });
  assert.equal(d.status, "paid");
  assert.equal(d.openCents, 0);
});

test("target hours for month from weekly soll", () => {
  // 40h/week → Aug 2026 has 31 days → 40 * 31 / 7 ≈ 177.1
  const h = targetHoursForCalendarMonth(40 * 60, 2026, 8);
  assert.ok(h != null && Math.abs(h - 177.1) < 0.05);
});
