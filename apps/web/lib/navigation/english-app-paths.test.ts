import assert from "node:assert/strict";
import { test } from "node:test";

import {
  canonicalizeAppHref,
  translatePathSegments,
} from "./english-app-paths.ts";

test("german dashboard paths become english", () => {
  assert.equal(
    canonicalizeAppHref("/dashboard/reservierungen/tischplan"),
    "/dashboard/reservations/floor-plan",
  );
  assert.equal(
    canonicalizeAppHref("/dashboard/speisekarte/uebersicht"),
    "/dashboard/menu/overview",
  );
  assert.equal(
    canonicalizeAppHref("/dashboard/nachrichten"),
    "/dashboard/contacts/messages",
  );
  assert.equal(
    canonicalizeAppHref("/reservierungen/tischplan"),
    "/dashboard/reservations/floor-plan",
  );
  assert.equal(
    canonicalizeAppHref("/dashboard/mitarbeiter/todos/protokoll"),
    "/dashboard/tasks/log",
  );
  assert.equal(
    canonicalizeAppHref("/settings/eigenkontrolle/eintraege"),
    "/dashboard/tasks/log",
  );
});

test("settings kasse stays the fiscal alias", () => {
  assert.equal(
    canonicalizeAppHref("/dashboard/settings/kasse"),
    "/dashboard/pos/settings/fiscal-payment",
  );
  assert.equal(
    translatePathSegments("/dashboard/settings/kasse"),
    "/dashboard/settings/kasse",
  );
  assert.equal(
    canonicalizeAppHref("/dashboard/buchfuehrung/kasse"),
    "/dashboard/accounting/cash-book",
  );
});

test("already english paths are unchanged", () => {
  const href = "/dashboard/menu/overview?tab=1#karte";
  assert.equal(canonicalizeAppHref(href), href);
  assert.equal(
    canonicalizeAppHref("/dashboard/contacts/messages?platform=all"),
    "/dashboard/contacts/messages?platform=all",
  );
});

test("api routes and external hrefs are not translated", () => {
  assert.equal(
    canonicalizeAppHref("/api/cron/notification-digests"),
    "/api/cron/notification-digests",
  );
  assert.equal(canonicalizeAppHref("https://gwada.app/impressum"), "https://gwada.app/impressum");
});

test("public german urls redirect to english", () => {
  assert.equal(canonicalizeAppHref("/impressum"), "/imprint");
  assert.equal(canonicalizeAppHref("/einladung/abc"), "/invitation/abc");
  assert.equal(
    canonicalizeAppHref("/embed/speisekarte/zur-schlagd"),
    "/embed/menu/zur-schlagd",
  );
  assert.equal(
    canonicalizeAppHref("/docs/handbuch/speisekarte"),
    "/docs/handbook/menu",
  );
  assert.equal(
    canonicalizeAppHref("/newsletter/abmelden/tok"),
    "/newsletter/unsubscribe/tok",
  );
  assert.equal(
    canonicalizeAppHref("/superadmin/allgemein"),
    "/superadmin/general",
  );
});
