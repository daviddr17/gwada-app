import assert from "node:assert/strict";
import { test } from "node:test";

import { sanitizeOpsText } from "./sanitize-ops-text.ts";

test("redacts bearer, cron secret, jwt and api keys", () => {
  const raw =
    "FAIL Authorization: Bearer secret-token-value CRON_SECRET=supersecret apikey=abc123 eyJhbGciOiJIUzI1NiJ9.payload.sig";
  const out = sanitizeOpsText(raw);
  assert.equal(out.includes("secret-token-value"), false);
  assert.equal(out.includes("supersecret"), false);
  assert.equal(out.includes("abc123"), false);
  assert.equal(out.includes("eyJhbGciOiJIUzI1NiJ9"), false);
  assert.match(out, /Bearer \*\*\*/);
  assert.match(out, /CRON_SECRET=\*\*\*/);
});

test("truncates long errors", () => {
  const out = sanitizeOpsText("x".repeat(400), 40);
  assert.equal(out.length, 40);
});
