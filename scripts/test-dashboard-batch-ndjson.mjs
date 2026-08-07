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

console.log("ok: ndjson progressive merge");
