import assert from "node:assert/strict";
import { test } from "node:test";

import {
  isPosComingSoonForViewer,
  isPosLiveForViewer,
} from "./pos-coming-soon.ts";

test("POS ist live nur für Superadmin", () => {
  assert.equal(isPosLiveForViewer(true), true);
  assert.equal(isPosLiveForViewer(false), false);
});

test("POS Coming soon für alle anderen", () => {
  assert.equal(isPosComingSoonForViewer(false), true);
  assert.equal(isPosComingSoonForViewer(true), false);
});
