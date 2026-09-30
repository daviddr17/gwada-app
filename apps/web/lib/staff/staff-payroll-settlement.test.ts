import assert from "node:assert/strict";
import { test } from "node:test";

import {
  derivePayrollSettlement,
  payrollCarryCentsBeforeMonth,
  payoutCentsFromHours,
  targetHoursForCalendarMonth,
  withPayrollCarryForward,
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

test("Übertrag: 1000 verdient, 600 gezahlt, danach 500 und 600", () => {
  const rows = withPayrollCarryForward([
    {
      staffId: "a",
      periodYear: 2026,
      periodMonth: 8,
      wageCents: 100_000,
      payoutCents: 60_000,
    },
    {
      staffId: "a",
      periodYear: 2026,
      periodMonth: 9,
      wageCents: 50_000,
      payoutCents: 60_000,
    },
  ]);
  assert.equal(rows[0]?.carryCents, 0);
  assert.equal(rows[0]?.dueCents, 40_000);
  assert.equal(rows[1]?.carryCents, 40_000);
  assert.equal(rows[1]?.dueCents, 30_000);
  assert.equal(rows[1]?.openCents, 30_000);
});

test("negativer Saldo wird in den nächsten Monat übernommen", () => {
  const rows = withPayrollCarryForward([
    {
      staffId: "a",
      periodYear: 2026,
      periodMonth: 8,
      wageCents: 50_000,
      payoutCents: 60_000,
    },
    {
      staffId: "a",
      periodYear: 2026,
      periodMonth: 9,
      wageCents: 50_000,
      payoutCents: 0,
    },
  ]);
  assert.equal(rows[0]?.dueCents, -10_000);
  assert.equal(rows[0]?.status, "overpaid");
  assert.equal(rows[1]?.carryCents, -10_000);
  assert.equal(rows[1]?.dueCents, 40_000);
  assert.equal(rows[1]?.openCents, 40_000);
});

test("Monat ohne eigene Zahlen behält den Übertrag", () => {
  const settled = withPayrollCarryForward([
    {
      staffId: "a",
      periodYear: 2026,
      periodMonth: 8,
      wageCents: 100_000,
      payoutCents: 60_000,
    },
  ]);
  assert.equal(payrollCarryCentsBeforeMonth(settled, "a", 2026, 9), 40_000);
  const quiet = derivePayrollSettlement({
    wageCents: 0,
    payoutCents: 0,
    carryCents: 40_000,
  });
  assert.equal(quiet.dueCents, 40_000);
  assert.equal(quiet.status, "open");
});

test("Mitarbeiter vermischen den Übertrag nicht", () => {
  const rows = withPayrollCarryForward([
    {
      staffId: "b",
      periodYear: 2026,
      periodMonth: 8,
      wageCents: 10_000,
      payoutCents: 0,
    },
    {
      staffId: "a",
      periodYear: 2026,
      periodMonth: 9,
      wageCents: 50_000,
      payoutCents: 60_000,
    },
    {
      staffId: "a",
      periodYear: 2026,
      periodMonth: 8,
      wageCents: 100_000,
      payoutCents: 60_000,
    },
  ]);
  const september = rows.find(
    (row) => row.staffId === "a" && row.periodMonth === 9,
  );
  assert.equal(september?.carryCents, 40_000);
  assert.equal(september?.dueCents, 30_000);
});

test("Stunden mal vorhandenem Stundenlohn, ohne eigenen Satz", () => {
  assert.equal(payoutCentsFromHours(10, 1500), 15_000);
  assert.equal(payoutCentsFromHours(1.5, 1500), 2250);
  assert.equal(payoutCentsFromHours(0, 1500), null);
  assert.equal(payoutCentsFromHours(2, 0), null);
  assert.equal(payoutCentsFromHours(-1, 1500), null);
});

test("target hours for month from weekly soll", () => {
  // 40h/week → Aug 2026 has 31 days → 40 * 31 / 7 ≈ 177.1
  const h = targetHoursForCalendarMonth(40 * 60, 2026, 8);
  assert.ok(h != null && Math.abs(h - 177.1) < 0.05);
});
