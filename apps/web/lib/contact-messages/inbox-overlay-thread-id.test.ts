import assert from "node:assert/strict";
import { test } from "node:test";

import {
  inboxNeighborContactIds,
  resolveInboxOverlayThreadId,
} from "./inbox-overlay-thread-id.ts";

test("Klick (pending) gewinnt vor alter ?contact=-URL", () => {
  assert.equal(
    resolveInboxOverlayThreadId({
      pendingContactId: "b",
      contactParam: "a",
      closingThreadId: "a",
    }),
    "b",
  );
});

test("ohne Pending gilt die URL, sonst der schließende Thread", () => {
  assert.equal(
    resolveInboxOverlayThreadId({
      pendingContactId: null,
      contactParam: "a",
      closingThreadId: "z",
    }),
    "a",
  );
  assert.equal(
    resolveInboxOverlayThreadId({
      pendingContactId: null,
      contactParam: null,
      closingThreadId: "z",
    }),
    "z",
  );
  assert.equal(
    resolveInboxOverlayThreadId({
      pendingContactId: null,
      contactParam: null,
      closingThreadId: null,
    }),
    null,
  );
});

test("Nachbarn der offenen Zeile", () => {
  const rows = [
    { contact_id: "a" },
    { contact_id: "b" },
    { contact_id: "c" },
  ];
  assert.deepEqual(inboxNeighborContactIds(rows, "b"), ["a", "c"]);
  assert.deepEqual(inboxNeighborContactIds(rows, "a"), ["b"]);
  assert.deepEqual(inboxNeighborContactIds(rows, "c"), ["b"]);
  assert.deepEqual(inboxNeighborContactIds(rows, "missing"), []);
  assert.deepEqual(inboxNeighborContactIds(rows, null), []);
});
