import assert from "node:assert/strict";
import { test } from "node:test";

import {
  STAY_SIGNED_IN_DEFAULT,
  applyStaySignedInToAuthCookieOptions,
  mapAuthCookiesForStaySignedIn,
  parseStaySignedInValue,
  resolveStaySignedInPreference,
} from "./stay-signed-in.ts";

test("parseStaySignedInValue accepts common truthy/falsy tokens", () => {
  assert.equal(parseStaySignedInValue("1"), true);
  assert.equal(parseStaySignedInValue("true"), true);
  assert.equal(parseStaySignedInValue("0"), false);
  assert.equal(parseStaySignedInValue("false"), false);
  assert.equal(parseStaySignedInValue(""), null);
  assert.equal(parseStaySignedInValue(undefined), null);
});

test("resolveStaySignedInPreference defaults to on for staff", () => {
  assert.equal(resolveStaySignedInPreference(null), STAY_SIGNED_IN_DEFAULT);
  assert.equal(STAY_SIGNED_IN_DEFAULT, true);
  assert.equal(resolveStaySignedInPreference("0"), false);
});

test("applyStaySignedInToAuthCookieOptions keeps long maxAge when on", () => {
  const opts = applyStaySignedInToAuthCookieOptions(
    { path: "/", maxAge: 400 * 24 * 60 * 60, sameSite: "lax" },
    true,
  );
  assert.equal(opts.maxAge, 400 * 24 * 60 * 60);
});

test("applyStaySignedInToAuthCookieOptions drops maxAge for session cookies", () => {
  const opts = applyStaySignedInToAuthCookieOptions(
    { path: "/", maxAge: 400 * 24 * 60 * 60, sameSite: "lax" },
    false,
  );
  assert.equal(opts.maxAge, undefined);
  assert.equal(opts.path, "/");
});

test("applyStaySignedInToAuthCookieOptions keeps maxAge 0 for deletes", () => {
  const opts = applyStaySignedInToAuthCookieOptions(
    { path: "/", maxAge: 0 },
    false,
  );
  assert.equal(opts.maxAge, 0);
});

test("mapAuthCookiesForStaySignedIn rewrites only non-delete cookies", () => {
  const mapped = mapAuthCookiesForStaySignedIn(
    [
      { name: "sb-gwada-auth", value: "tok", options: { maxAge: 99 } },
      { name: "sb-gwada-auth", value: "", options: { maxAge: 0 } },
    ],
    false,
  );
  assert.equal(mapped[0]?.options?.maxAge, undefined);
  assert.equal(mapped[1]?.options?.maxAge, 0);
});
