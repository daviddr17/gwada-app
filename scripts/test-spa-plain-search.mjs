#!/usr/bin/env node
/**
 * Regression: Soft-Nav Query `new=1` must stay plain (not JSON-quoted).
 *
 * TanStack default JSON search turns `{ new: "1" }` into `?new=%221%22`.
 * Reading via URLSearchParams then makes `get("new") === "1"` false while
 * `day=YYYY-MM-DD` still works — FAB „Neue Reservierung“ opened the day sheet.
 *
 * Full FAB matrix: every Dashboard Plus-menu shortcut ↔ module gate.
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

/**
 * Mirrors `dashboardShortcutHref` + module `searchParams.get("new")` gates.
 * Keep in sync with `lib/constants/dashboard-shortcuts.ts` and the screens.
 */
const FAB_SHORTCUTS = [
  {
    id: "reservation",
    hrefPath: "/dashboard/reservierungen/uebersicht",
    search: { new: "1", day: "2026-09-11" },
    gate: (p) => p.get("new") === "1",
    wasBrokenByJsonCodec: true,
  },
  {
    id: "menu_dish",
    hrefPath: "/dashboard/menu/uebersicht",
    search: { new: "1" },
    gate: (p) => p.get("new") === "1",
    wasBrokenByJsonCodec: true,
  },
  {
    id: "inventory_ingredient",
    hrefPath: "/dashboard/inventory/uebersicht",
    search: { new: "1" },
    gate: (p) => p.get("new") === "1",
    wasBrokenByJsonCodec: true,
  },
  {
    id: "contact",
    hrefPath: "/dashboard/kontakte/uebersicht",
    search: { new: "1" },
    gate: (p) => p.get("new") === "1",
    wasBrokenByJsonCodec: true,
  },
  {
    id: "document",
    hrefPath: "/dashboard/dokumente/uebersicht",
    search: { new: "1" },
    gate: (p) => p.get("new") === "1",
    wasBrokenByJsonCodec: true,
  },
  {
    id: "staff_member",
    hrefPath: "/dashboard/mitarbeiter/uebersicht",
    search: { new: "1" },
    gate: (p) => p.get("new") === "1",
    wasBrokenByJsonCodec: true,
  },
  {
    id: "staff_shift",
    hrefPath: "/dashboard/mitarbeiter/schichtplan",
    search: { new: "1" },
    gate: (p) => p.get("new") === "1",
    wasBrokenByJsonCodec: true,
  },
  {
    id: "staff_work_entry",
    hrefPath: "/dashboard/mitarbeiter/arbeitszeiten",
    search: { new: "1" },
    gate: (p) => p.get("new") === "1",
    wasBrokenByJsonCodec: true,
  },
  {
    id: "shift_template",
    hrefPath: "/dashboard/mitarbeiter/schichtplan",
    search: { new: "template" },
    gate: (p) => p.get("new") === "template",
    wasBrokenByJsonCodec: false,
  },
  {
    id: "review_invite",
    hrefPath: "/dashboard/bewertungen/uebersicht",
    search: { new: "invite" },
    gate: (p) => p.get("new") === "invite",
    wasBrokenByJsonCodec: false,
  },
];

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

for (const shortcut of FAB_SHORTCUTS) {
  const plainEncoded = stringifySpaPlainSearch(shortcut.search);
  const plainParsed = parseSpaPlainSearch(plainEncoded);
  const shimParams = urlSearchParamsFromParsedSearch(plainParsed);
  assert.equal(
    shortcut.gate(shimParams),
    true,
    `${shortcut.id}: plain Soft-Nav must pass module gate (${shortcut.hrefPath})`,
  );

  const legacyEncoded = tanstackDefaultStringifySearch(shortcut.search);
  const legacyParams = new URLSearchParams(
    legacyEncoded.startsWith("?") ? legacyEncoded.slice(1) : legacyEncoded,
  );
  const legacyPasses = shortcut.gate(legacyParams);
  if (shortcut.wasBrokenByJsonCodec) {
    assert.equal(
      legacyPasses,
      false,
      `${shortcut.id}: documents JSON-codec break before plain fix`,
    );
  } else {
    assert.equal(
      legacyPasses,
      true,
      `${shortcut.id}: non-numeric new= values were already plain`,
    );
  }
}

assert.equal(FAB_SHORTCUTS.length, 10, "all Dashboard FAB shortcuts audited");

console.log(
  "ok: spa plain search — all 10 FAB shortcuts pass module gates (incl. staff_member)",
);
