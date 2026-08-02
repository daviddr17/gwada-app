/**
 * Parität: Node posDisplayPinOfflineHash ↔ SQL pos_display_pin_offline_hash.
 * Run: node scripts/test-display-pin-offline-hash.mjs
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

function posDisplayPinOfflineHash(pin, restaurantId) {
  return createHash("sha256")
    .update(`${pin}\0${restaurantId}\0gwada-pos-offline-v1`, "utf8")
    .digest("hex");
}

const pin = "1234";
const restaurantId = "fcc50bb3-130d-476b-94dc-3c7392b773a8";
const viaTemplate = posDisplayPinOfflineHash(pin, restaurantId);
const viaBuffers = createHash("sha256")
  .update(
    Buffer.concat([
      Buffer.from(pin, "utf8"),
      Buffer.from([0]),
      Buffer.from(restaurantId, "utf8"),
      Buffer.from([0]),
      Buffer.from("gwada-pos-offline-v1", "utf8"),
    ]),
  )
  .digest("hex");

assert.equal(viaTemplate, viaBuffers);
assert.equal(
  viaTemplate,
  "f2a8869739fb29d2706d1f7c24353b2ab62a3ab1143fa7d9228ada7c5c0a2cd6",
);
console.log("ok: display pin offline hash encoding");
