import assert from "node:assert/strict";
import { test } from "node:test";

import {
  AUTH_PASSWORD_EMAIL_LIMIT,
  enforcePasswordGrantRateLimit,
} from "@/lib/api/auth-password-rate-limit";

function grant(email: string): ArrayBuffer {
  const encoded = new TextEncoder().encode(
    JSON.stringify({ email, password: "secret" }),
  );
  return encoded.buffer.slice(
    encoded.byteOffset,
    encoded.byteOffset + encoded.byteLength,
  ) as ArrayBuffer;
}

test("password grant rate limit blocks one email without locking other users", async () => {
  const email = `rate-${Date.now()}@example.com`;
  const ip = `203.0.113.${Date.now() % 200}`;
  const request = new Request("https://gwada.app/sb/auth/v1/token", {
    headers: { "x-real-ip": ip },
  });

  for (let i = 0; i < AUTH_PASSWORD_EMAIL_LIMIT; i++) {
    assert.equal(enforcePasswordGrantRateLimit(request, grant(email)), null);
  }
  const blocked = enforcePasswordGrantRateLimit(request, grant(email));
  assert.ok(blocked);
  assert.equal(blocked!.status, 429);

  const other = enforcePasswordGrantRateLimit(
    request,
    grant(`other-${Date.now()}@example.com`),
  );
  assert.equal(other, null);
});
