#!/usr/bin/env node
/**
 * Unit checks for Fiskaly provision helpers (no Fiskaly API).
 * Usage: node scripts/test-fiskaly-provision-unit.mjs
 */
import assert from "node:assert/strict";
import {
  fiskalyClientSerialFromRestaurant,
  formatFiskalyLocationLabel,
} from "../apps/web/lib/pos/fiskaly-provision-serial.ts";
import {
  germanFiskalyProvisionError,
  suggestsFiskalyReconcile,
  fiskalyProvisionOutcomeLabel,
} from "../apps/web/lib/pos/fiskaly-error-messages.ts";

const rid = "fad22222-2222-4222-8222-222222222201";
const serial = fiskalyClientSerialFromRestaurant("fadis-burgerstation", rid);
assert.match(serial, /^gwada-fadis-burgerstation-[a-f0-9]{8}$/);
assert.ok(!serial.includes("_"));
assert.ok(!serial.includes("/"));
assert.ok(serial.length <= 70);

const serial2 = fiskalyClientSerialFromRestaurant("fadis-burgerstation", rid);
assert.equal(serial, serial2, "serial must be deterministic");

const label = formatFiskalyLocationLabel({
  name: "Fadis BurgerStation",
  city: "Berlin",
  country: "DE",
  address_line1: "Bergmannstraße 12",
});
assert.equal(label, "Fadis BurgerStation · Berlin, DE (Bergmannstraße 12)");

const rawErr =
  "Client create: Fiskaly SIGN DE HTTP 400: E_ILLEGAL_CLIENT_SERIAL — duplicate";
const err = germanFiskalyProvisionError(rawErr);
assert.match(err, /Serien-Nr/);
assert.equal(suggestsFiskalyReconcile(rawErr), true);

assert.equal(fiskalyProvisionOutcomeLabel("created"), "Neu bei Fiskaly angelegt");
assert.equal(
  fiskalyProvisionOutcomeLabel("skipped_ready", { dsfinvkBackfillOnly: true }),
  "Bereit (DSFinV-K nachgezogen)",
);

console.log("fiskaly provision unit checks: OK");
