import assert from "node:assert/strict";
import { test } from "node:test";

import {
  BILLING_PAST_DUE_GRACE_DAYS,
  isBillingDunningStatus,
  isBillingPastDueSweepDue,
  isPastDueAccessLocked,
  isStripeSubscriptionInvoice,
  mapStripeSubscriptionStatus,
  nextPastDueSince,
  pastDueAccessEndsAt,
  shouldGrantPaidPlanFeatures,
} from "./past-due-grace.ts";

const T0 = "2026-08-01T12:00:00.000Z";
const DAY = 24 * 60 * 60 * 1000;

test("Karenz ist 7 Tage", () => {
  assert.equal(BILLING_PAST_DUE_GRACE_DAYS, 7);
  const ends = pastDueAccessEndsAt(T0);
  assert.equal(ends, "2026-08-08T12:00:00.000Z");
});

test("Paid-Features: Stripe active bleibt an", () => {
  assert.equal(
    shouldGrantPaidPlanFeatures({
      source: "stripe",
      status: "active",
      pastDueSince: null,
    }),
    true,
  );
});

test("Paid-Features: erster Checkout incomplete sofort Free", () => {
  assert.equal(
    shouldGrantPaidPlanFeatures({
      source: "stripe",
      status: "incomplete",
      pastDueSince: T0,
    }),
    false,
  );
});

test("Paid-Features: past_due innerhalb von 7 Tagen bleibt an", () => {
  const now = new Date(Date.parse(T0) + 6 * DAY);
  assert.equal(
    shouldGrantPaidPlanFeatures({
      source: "stripe",
      status: "past_due",
      pastDueSince: T0,
      now,
    }),
    true,
  );
  assert.equal(
    isPastDueAccessLocked({
      source: "stripe",
      status: "past_due",
      pastDueSince: T0,
      now,
    }),
    false,
  );
});

test("Paid-Features: unpaid ab Tag 7 auf Free", () => {
  const now = new Date(Date.parse(T0) + 7 * DAY);
  assert.equal(
    shouldGrantPaidPlanFeatures({
      source: "stripe",
      status: "unpaid",
      pastDueSince: T0,
      now,
    }),
    false,
  );
});

test("Paid-Features: past_due ab Tag 7 auf Free", () => {
  const now = new Date(Date.parse(T0) + 7 * DAY);
  assert.equal(
    shouldGrantPaidPlanFeatures({
      source: "stripe",
      status: "past_due",
      pastDueSince: T0,
      now,
    }),
    false,
  );
  assert.equal(
    isPastDueAccessLocked({
      source: "stripe",
      status: "past_due",
      pastDueSince: T0,
      now,
    }),
    true,
  );
});

test("Paid-Features: stale Uhr bei active sperrt nicht", () => {
  const now = new Date(Date.parse(T0) + 10 * DAY);
  assert.equal(
    shouldGrantPaidPlanFeatures({
      source: "stripe",
      status: "active",
      pastDueSince: T0,
      now,
    }),
    true,
  );
  assert.equal(
    isPastDueAccessLocked({
      source: "stripe",
      status: "active",
      pastDueSince: T0,
      now,
    }),
    false,
  );
});

test("Paid-Features: Legacy/Kulanz unabhängig von Stripe-Status", () => {
  assert.equal(
    shouldGrantPaidPlanFeatures({
      source: "legacy",
      status: "past_due",
      pastDueSince: T0,
      now: new Date(Date.parse(T0) + 30 * DAY),
    }),
    true,
  );
  assert.equal(
    shouldGrantPaidPlanFeatures({
      source: "complimentary",
      status: "canceled",
      pastDueSince: null,
    }),
    true,
  );
});

test("Uhr: erster past_due setzt, Folge-Events behalten T0", () => {
  const first = nextPastDueSince({
    existing: null,
    status: "past_due",
    nowIso: T0,
  });
  assert.equal(first, T0);
  const kept = nextPastDueSince({
    existing: T0,
    status: "unpaid",
    nowIso: "2026-08-03T12:00:00.000Z",
  });
  assert.equal(kept, T0);
});

test("Uhr: active leert, außer Invoice noch offen", () => {
  assert.equal(
    nextPastDueSince({ existing: T0, status: "active" }),
    null,
  );
  assert.equal(
    nextPastDueSince({
      existing: T0,
      status: "active",
      latestInvoiceOpen: true,
    }),
    T0,
  );
  assert.equal(
    nextPastDueSince({ existing: T0, status: "canceled" }),
    null,
  );
});

test("incomplete_expired wird canceled, nie active", () => {
  assert.equal(mapStripeSubscriptionStatus("incomplete_expired"), "canceled");
  assert.equal(mapStripeSubscriptionStatus("bogus_status"), "bogus_status");
  assert.equal(isBillingDunningStatus("incomplete"), false);
  assert.equal(isBillingDunningStatus("past_due"), true);
});

test("Daily Sweep-Fenster ist 06:00–06:19 UTC", () => {
  assert.equal(
    isBillingPastDueSweepDue(new Date("2026-08-20T05:59:00.000Z")),
    false,
  );
  assert.equal(
    isBillingPastDueSweepDue(new Date("2026-08-20T06:00:00.000Z")),
    true,
  );
  assert.equal(
    isBillingPastDueSweepDue(new Date("2026-08-20T06:19:00.000Z")),
    true,
  );
  assert.equal(
    isBillingPastDueSweepDue(new Date("2026-08-20T06:20:00.000Z")),
    false,
  );
});

test("Nur Abo-Rechnungen mit Betrag starten die Uhr", () => {
  assert.equal(
    isStripeSubscriptionInvoice({ subscriptionId: "sub_1", amountDue: 4900 }),
    true,
  );
  assert.equal(
    isStripeSubscriptionInvoice({ subscriptionId: "sub_1", amountDue: 0 }),
    false,
  );
  assert.equal(
    isStripeSubscriptionInvoice({ subscriptionId: null, amountDue: 4900 }),
    false,
  );
});
