import assert from "node:assert/strict";
import { test } from "node:test";

import {
  isWahaSessionAlreadyGone,
  WAHA_SESSION_ADMIN_ACTIONS,
} from "./waha-server-types.ts";

test("superadmin session actions include delete", () => {
  assert.ok(WAHA_SESSION_ADMIN_ACTIONS.includes("delete"));
  assert.ok(WAHA_SESSION_ADMIN_ACTIONS.includes("logout"));
  assert.ok(WAHA_SESSION_ADMIN_ACTIONS.includes("restart"));
});

test("missing WAHA session is treated as already gone", () => {
  assert.equal(isWahaSessionAlreadyGone(404), true);
  assert.equal(isWahaSessionAlreadyGone(200), false);
  assert.equal(isWahaSessionAlreadyGone(502), false);
});
