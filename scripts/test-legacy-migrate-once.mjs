#!/usr/bin/env node
/**
 * loadRelationalOrLegacyMigrate: ein Load wenn Daten da sind,
 * Migrate+Reload nur bei leerer Tabelle, und nur einmal pro Key.
 */
import assert from "node:assert/strict";

const attempted = new Set();

function takeLegacyMigrateAttempt(key) {
  if (attempted.has(key)) return false;
  attempted.add(key);
  return true;
}

async function loadRelationalOrLegacyMigrate(attemptKey, load, migrateEmpty) {
  const first = await load();
  if (first && first.length > 0) return first;
  if (!takeLegacyMigrateAttempt(attemptKey)) return first;
  await migrateEmpty();
  return load();
}

let loads = 0;
let migrates = 0;

const rows = await loadRelationalOrLegacyMigrate(
  "menu-items:r1",
  async () => {
    loads += 1;
    return [{ id: "1" }];
  },
  async () => {
    migrates += 1;
  },
);
assert.equal(rows.length, 1);
assert.equal(loads, 1);
assert.equal(migrates, 0);

loads = 0;
migrates = 0;
let emptyThen = true;
const afterMigrate = await loadRelationalOrLegacyMigrate(
  "menu-items:r2",
  async () => {
    loads += 1;
    if (emptyThen) {
      emptyThen = false;
      return [];
    }
    return [{ id: "2" }];
  },
  async () => {
    migrates += 1;
  },
);
assert.equal(afterMigrate[0].id, "2");
assert.equal(loads, 2);
assert.equal(migrates, 1);

loads = 0;
migrates = 0;
const skipped = await loadRelationalOrLegacyMigrate(
  "menu-items:r2",
  async () => {
    loads += 1;
    return [];
  },
  async () => {
    migrates += 1;
  },
);
assert.deepEqual(skipped, []);
assert.equal(loads, 1);
assert.equal(migrates, 0);

console.log("ok: legacy migrate once");
