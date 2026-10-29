import assert from "node:assert/strict";
import { test } from "node:test";

import { isGratisBillingSource } from "./gratis-billing.ts";

test("Legacy und Complimentary sind gratis", () => {
  assert.equal(isGratisBillingSource("legacy", "legacy"), true);
  assert.equal(isGratisBillingSource("legacy", "active"), true);
  assert.equal(isGratisBillingSource("complimentary", "active"), true);
  assert.equal(isGratisBillingSource("mollie", "legacy"), true);
  assert.equal(isGratisBillingSource("mollie", "active"), false);
  assert.equal(isGratisBillingSource("manual", "active"), false);
});
