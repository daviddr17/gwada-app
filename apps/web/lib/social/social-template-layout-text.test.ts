import assert from "node:assert/strict";
import { test } from "node:test";
import {
  layoutHeadline,
  layoutSupportingLine,
  wrapLayoutLines,
} from "./social-template-layout-text";

test("layoutHeadline ignores Galerie placeholder", () => {
  assert.equal(
    layoutHeadline("Galerie", "Terrasse am Fluss bei Sonne.", "Restaurant"),
    "Terrasse am Fluss bei Sonne",
  );
});

test("layoutHeadline prefers real title", () => {
  assert.equal(
    layoutHeadline("Holstein Rind", "Saftig gebraten.", "X"),
    "Holstein Rind",
  );
});

test("wrapLayoutLines respects max lines", () => {
  const lines = wrapLayoutLines(
    "Sommerterrasse am Hafen mit Abendlicht",
    16,
    2,
  );
  assert.equal(lines.length, 2);
  assert.ok(lines[0]!.length <= 18);
});

test("layoutSupportingLine drops headline prefix", () => {
  const support = layoutSupportingLine(
    "Holstein Rind. Saftig und warm serviert.",
    "Holstein Rind",
  );
  assert.match(support, /Saftig/i);
  assert.doesNotMatch(support, /^Holstein/i);
});
