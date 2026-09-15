/**
 * Smoke-test for NDJSON progressive merge (no Next/server needed).
 */
import assert from "node:assert/strict";

function isWidgetLine(line) {
  return (
    typeof line === "object" &&
    line != null &&
    "w" in line &&
    typeof line.w === "string" &&
    !("done" in line)
  );
}

function apply(base, line) {
  if (line.e) {
    return {
      data: base.data,
      errors: { ...base.errors, [line.w]: line.e },
    };
  }
  if (line.d === undefined) return base;
  return {
    data: { ...base.data, [line.w]: line.d },
    errors: base.errors,
  };
}

/** Mirrors mergeDashboardBatchStreamPublish (stale-while-revalidate). */
function mergeStreamPublish({ existing, streamAcc, requestedWidgets }) {
  const data = { ...(existing?.data ?? {}) };
  const errors = { ...(existing?.errors ?? {}) };

  for (const widget of requestedWidgets) {
    if (Object.prototype.hasOwnProperty.call(streamAcc.data, widget)) {
      data[widget] = streamAcc.data[widget];
      if (!Object.prototype.hasOwnProperty.call(streamAcc.errors, widget)) {
        delete errors[widget];
      }
    }
    if (Object.prototype.hasOwnProperty.call(streamAcc.errors, widget)) {
      errors[widget] = streamAcc.errors[widget];
    }
  }

  return { data, errors };
}

function parseStream(text, onPartial) {
  let acc = { data: {}, errors: {} };
  const paints = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const parsed = JSON.parse(line);
    if (isWidgetLine(parsed)) {
      acc = apply(acc, parsed);
      paints.push({ ...acc.data });
      onPartial?.(acc);
    }
  }
  return { acc, paints };
}

const stream = [
  JSON.stringify({ w: "inventory", d: { emptyStock: 2, openOrders: 1 } }),
  JSON.stringify({ w: "messages", d: { total_unread: 4, unread: [] } }),
  JSON.stringify({ w: "reservations", d: { unconfirmedCount: 3 } }),
  JSON.stringify({ w: "staff", e: "load_failed" }),
  JSON.stringify({ done: true, errors: { staff: "load_failed" } }),
].join("\n");

const { acc, paints } = parseStream(stream);

assert.equal(paints.length, 4, "four progressive paints");
assert.equal(paints[0].inventory.emptyStock, 2);
assert.equal(paints[1].messages.total_unread, 4);
assert.equal(paints[2].reservations.unconfirmedCount, 3);
assert.equal(acc.errors.staff, "load_failed");
assert.equal(acc.data.staff, undefined);

// First paint must not wait for later widgets
assert.equal(Object.keys(paints[0]).join(","), "inventory");
assert.ok(!("reservations" in paints[0]));

// Refetch: keep reviews while reservations streams in first
const kept = mergeStreamPublish({
  existing: {
    data: {
      reviews: { unreadRecentCount: 2 },
      reservations: { unconfirmedCount: 1 },
    },
    errors: {},
  },
  streamAcc: {
    data: { reservations: { unconfirmedCount: 4 } },
    errors: {},
  },
  requestedWidgets: ["reservations", "reviews", "checklists"],
});
assert.equal(kept.data.reservations.unconfirmedCount, 4);
assert.equal(kept.data.reviews.unreadRecentCount, 2);
assert.equal(kept.data.checklists, undefined);

const clearedError = mergeStreamPublish({
  existing: {
    data: {},
    errors: { reviews: "load_failed" },
  },
  streamAcc: {
    data: { reviews: { unreadRecentCount: 0 } },
    errors: {},
  },
  requestedWidgets: ["reviews"],
});
assert.deepEqual(clearedError.data.reviews, { unreadRecentCount: 0 });
assert.equal(clearedError.errors.reviews, undefined);

console.log("ok: ndjson progressive merge");
