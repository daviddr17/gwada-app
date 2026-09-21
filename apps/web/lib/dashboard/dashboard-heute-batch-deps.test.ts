import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("Heute-Batch-Deps listen checklists (kein Hänger ohne Slice)", () => {
  const src = readFileSync(
    new URL("./dashboard-heute-batch-deps.ts", import.meta.url),
    "utf8",
  );
  assert.match(
    src,
    /DASHBOARD_HEUTE_BATCH_WIDGET_IDS\s*=\s*\[[^\]]*\"checklists\"/s,
  );
});
