import assert from "node:assert/strict";
import { test } from "node:test";

import { BILLING_PLANS } from "./plan-catalog.ts";
import { formatMollieAmountValue } from "../mollie/mollie-amount.ts";

/** Mirrors billing-security.ts helpers for strip-types node tests (no @/ aliases). */

const BILLING_MANDATE_UPDATE_EUROS = 0.01;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ORIGIN = "https://gwada.app";
const RESTAURANT = "11111111-1111-4111-8111-111111111111";

function isBillingPurpose(value: string | null | undefined): boolean {
  return (
    value === "billing_first" ||
    value === "billing_update_mandate" ||
    value === "billing_proration"
  );
}

function paymentMatchesBillingCatalogAmount(input: {
  amount: { currency: string; value: string };
  planId: "basic" | "pro";
  interval: "month" | "year";
  includePos: boolean;
}): boolean {
  if ((input.amount.currency || "").toUpperCase() !== "EUR") return false;
  const plan = BILLING_PLANS[input.planId];
  let euros =
    input.interval === "year"
      ? plan.price.yearlyPerMonthEur * 12
      : plan.price.monthlyEur;
  euros = Math.round(euros * 100) / 100;
  const expectedValue = formatMollieAmountValue(euros);
  return input.amount.value === expectedValue;
}

function paymentMatchesMandateUpdateAmount(amount: {
  currency: string;
  value: string;
}): boolean {
  return (
    amount.currency.toUpperCase() === "EUR" &&
    amount.value === formatMollieAmountValue(BILLING_MANDATE_UPDATE_EUROS)
  );
}

function sanitizeBillingReturnUrl(
  candidate: string | null | undefined,
  origin: string,
  fallbackPath = "/dashboard/settings/billing",
): string {
  const fallback = `${origin.replace(/\/$/, "")}${fallbackPath}`;
  const raw = candidate?.trim() ?? "";
  if (!raw) return fallback;
  try {
    const base = new URL(origin);
    const url = new URL(raw, base);
    if (url.origin !== base.origin) return fallback;
    if (url.username || url.password) return fallback;
    const lowered = `${url.pathname}?${url.search}#${url.hash}`.toLowerCase();
    if (
      /(^|[?&#_])(api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|authorization|bearer|password|secret)=/.test(
        lowered,
      )
    ) {
      return fallback;
    }
    if (!url.pathname.startsWith("/dashboard")) return fallback;
    return `${url.origin}${url.pathname}${url.search}`;
  } catch {
    return fallback;
  }
}

function publicBillingError(
  code: string | null | undefined,
  fallback: string,
): string {
  const value = (code ?? "").trim();
  if (!value) return fallback;
  if (/^[a-z][a-z0-9_]{2,64}$/.test(value) && !value.includes(" ")) {
    return value;
  }
  return fallback;
}

test("billing purposes are allowlisted", () => {
  assert.equal(isBillingPurpose("billing_first"), true);
  assert.equal(isBillingPurpose("guest_checkout"), false);
});

test("catalog amount binding rejects underpayment", () => {
  const catalog = BILLING_PLANS.basic.price.monthlyEur;
  assert.equal(
    paymentMatchesBillingCatalogAmount({
      amount: { currency: "EUR", value: formatMollieAmountValue(catalog) },
      planId: "basic",
      interval: "month",
      includePos: false,
    }),
    true,
  );
  assert.equal(
    paymentMatchesBillingCatalogAmount({
      amount: { currency: "EUR", value: "0.01" },
      planId: "basic",
      interval: "month",
      includePos: false,
    }),
    false,
  );
});

test("mandate update only accepts verification amount", () => {
  assert.equal(
    paymentMatchesMandateUpdateAmount({
      currency: "EUR",
      value: formatMollieAmountValue(BILLING_MANDATE_UPDATE_EUROS),
    }),
    true,
  );
  assert.equal(
    paymentMatchesMandateUpdateAmount({ currency: "EUR", value: "9.99" }),
    false,
  );
});

test("restaurant UUID + return URL + public error guards", () => {
  assert.equal(UUID_RE.test(RESTAURANT), true);
  assert.equal(UUID_RE.test("not-a-uuid"), false);
  assert.equal(
    sanitizeBillingReturnUrl("https://evil.example/phish", ORIGIN),
    `${ORIGIN}/dashboard/settings/billing`,
  );
  assert.equal(
    sanitizeBillingReturnUrl(
      `${ORIGIN}/dashboard/settings/billing?api_key=test_leak`,
      ORIGIN,
    ),
    `${ORIGIN}/dashboard/settings/billing`,
  );
  assert.equal(
    publicBillingError("No adequate payment method found", "checkout_failed"),
    "checkout_failed",
  );
  assert.equal(
    publicBillingError("payment_create_failed", "checkout_failed"),
    "payment_create_failed",
  );
});
