import assert from "node:assert/strict";
import { test } from "node:test";

import {
  BASIC_REGISTERED_USER_LIMIT,
  FREE_REGISTERED_USER_LIMIT,
  isRegisteredUserLimitError,
  registeredUserLimitToastMessage,
  registeredUserSeatCap,
} from "./registered-user-seats.ts";

test("Free ist auf 1 Login begrenzt, Basic auf 3", () => {
  assert.equal(FREE_REGISTERED_USER_LIMIT, 1);
  assert.equal(BASIC_REGISTERED_USER_LIMIT, 3);
  assert.equal(
    registeredUserSeatCap({
      planId: "free",
      source: "manual",
      status: "active",
      pastDueGraceExpired: false,
    }),
    1,
  );
  assert.equal(
    registeredUserSeatCap({
      planId: "basic",
      source: "stripe",
      status: "active",
      pastDueGraceExpired: false,
    }),
    3,
  );
});

test("Pro ist unbegrenzt", () => {
  assert.equal(
    registeredUserSeatCap({
      planId: "pro",
      source: "stripe",
      status: "active",
      pastDueGraceExpired: false,
    }),
    null,
  );
});

test("Nach 7-Tage-Karenz zählt Pro wie Free", () => {
  assert.equal(
    registeredUserSeatCap({
      planId: "pro",
      source: "stripe",
      status: "past_due",
      pastDueGraceExpired: true,
    }),
    1,
  );
});

test("Legacy und Complimentary bleiben unbegrenzt", () => {
  assert.equal(
    registeredUserSeatCap({
      planId: "free",
      source: "legacy",
      status: "legacy",
      pastDueGraceExpired: false,
    }),
    null,
  );
  assert.equal(
    registeredUserSeatCap({
      planId: "basic",
      source: "complimentary",
      status: "active",
      pastDueGraceExpired: false,
    }),
    null,
  );
});

test("Gekündigtes Pro fällt auf das Free-Limit", () => {
  assert.equal(
    registeredUserSeatCap({
      planId: "pro",
      source: "stripe",
      status: "canceled",
      pastDueGraceExpired: false,
    }),
    1,
  );
});

test("Admin-Toasts nennen das konkrete Limit", () => {
  assert.equal(
    registeredUserLimitToastMessage(1).includes("1 App-Login"),
    true,
  );
  assert.equal(
    registeredUserLimitToastMessage(3).includes("3 App-Logins"),
    true,
  );
});

test("Postgres-Fehlertext user_limit wird erkannt", () => {
  assert.equal(isRegisteredUserLimitError("user_limit"), true);
  assert.equal(isRegisteredUserLimitError("ERROR:  user_limit"), true);
  assert.equal(isRegisteredUserLimitError("invite_not_found"), false);
});
