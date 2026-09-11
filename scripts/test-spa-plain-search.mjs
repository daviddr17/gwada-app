#!/usr/bin/env node
/**
 * Regression: Soft-Nav Query `new=1` must stay plain (not JSON-quoted).
 *
 * TanStack default JSON search turns `{ new: "1" }` into `?new=%221%22`.
 * Reading via URLSearchParams then makes `get("new") === "1"` false while
 * `day=YYYY-MM-DD` still works — FAB „Neue Reservierung“ opened the day sheet.
 */
import assert from "node:assert/strict";

function parseSpaPlainSearch(searchStr) {
  const raw = searchStr.startsWith("?") ? searchStr.slice(1) : searchStr;
  const out = {};
  if (!raw) return out;
  for (const [key, value] of new URLSearchParams(raw)) {
    out[key] = value;
  }
  return out;
}

function stringifySpaPlainSearch(search) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "string") {
      params.set(key, value);
    } else if (
      typeof value === "number" ||
      typeof value === "boolean" ||
      typeof value === "bigint"
    ) {
      params.set(key, String(value));
    } else {
      params.set(key, JSON.stringify(value));
    }
  }
  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}

function urlSearchParamsFromParsedSearch(search) {
  const params = new URLSearchParams();
  if (!search) return params;
  for (const [key, value] of Object.entries(search)) {
    if (value === undefined || value === null) continue;
    params.set(key, typeof value === "string" ? value : String(value));
  }
  return params;
}

/** Mimic TanStack default JSON value encoding for a single string value. */
function tanstackDefaultEncodeString(value) {
  try {
    JSON.parse(value);
    return encodeURIComponent(JSON.stringify(value));
  } catch {
    return encodeURIComponent(value);
  }
}

function tanstackDefaultStringifySearch(search) {
  const parts = [];
  for (const [key, value] of Object.entries(search)) {
    if (value == null) continue;
    if (typeof value === "string") {
      parts.push(
        `${encodeURIComponent(key)}=${tanstackDefaultEncodeString(value)}`,
      );
    } else {
      parts.push(
        `${encodeURIComponent(key)}=${encodeURIComponent(JSON.stringify(value))}`,
      );
    }
  }
  return parts.length ? `?${parts.join("&")}` : "";
}

const fabSearch = { new: "1", day: "2026-09-11" };

const broken = tanstackDefaultStringifySearch(fabSearch);
assert.equal(
  broken,
  "?new=%221%22&day=2026-09-11",
  "documents the TanStack default trap",
);
const brokenParams = new URLSearchParams(
  broken.startsWith("?") ? broken.slice(1) : broken,
);
assert.notEqual(brokenParams.get("new"), "1");
assert.equal(brokenParams.get("day"), "2026-09-11");

const plain = stringifySpaPlainSearch(fabSearch);
assert.equal(plain, "?new=1&day=2026-09-11");
const plainParams = new URLSearchParams(plain.slice(1));
assert.equal(plainParams.get("new"), "1");
assert.equal(plainParams.get("day"), "2026-09-11");
assert.deepEqual(parseSpaPlainSearch(plain), fabSearch);

assert.equal(
  urlSearchParamsFromParsedSearch({ new: "1", day: "2026-09-11" }).get("new"),
  "1",
);
assert.equal(
  urlSearchParamsFromParsedSearch({ new: 1, day: "2026-09-11" }).get("new"),
  "1",
);

// FAB deep-link gate as used by reservations overview
const isNewParam = plainParams.get("new") === "1";
const dayParam = plainParams.get("day");
assert.equal(isNewParam, true);
assert.match(dayParam, /^\d{4}-\d{2}-\d{2}$/);

/** All Dashboard FAB shortcut queries that modules gate with get("new") === … */
const fabQueries = [
  { new: "1", day: "2026-09-11" }, // reservation
  { new: "1" }, // menu, inventory, contact, document, staff, shift, work hours
  { new: "template" }, // shift template
  { new: "invite" }, // review invite
];
for (const q of fabQueries) {
  const encoded = stringifySpaPlainSearch(q);
  const params = new URLSearchParams(encoded.slice(1));
  for (const [k, v] of Object.entries(q)) {
    assert.equal(
      params.get(k),
      v,
      `FAB query ${k}=${v} must stay plain after Soft-Nav stringify`,
    );
  }
}

console.log("ok: spa plain search keeps new=1 readable for FAB deep links");
