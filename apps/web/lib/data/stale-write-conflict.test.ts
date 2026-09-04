import assert from "node:assert/strict";
import { test } from "node:test";

import {
  STALE_WRITE_CONFLICT_MESSAGE,
  isStaleWriteConflict,
  resolveMissingUpdateConflict,
  staleWriteConflictError,
} from "./stale-write-conflict.ts";

test("recognizes typed conflict errors", () => {
  assert.equal(isStaleWriteConflict(staleWriteConflictError()), true);
  assert.equal(isStaleWriteConflict(new Error("other")), false);
  assert.equal(isStaleWriteConflict(null), false);
});

test("missing row without expected version is not a conflict", async () => {
  const error = await resolveMissingUpdateConflict({
    exists: async () => true,
  });
  assert.equal(isStaleWriteConflict(error), false);
});

test("filtered update with expected version is a conflict when the row still exists", async () => {
  const error = await resolveMissingUpdateConflict({
    expectedUpdatedAt: "2026-09-04T10:00:00.000Z",
    exists: async () => true,
  });
  assert.equal(isStaleWriteConflict(error), true);
  assert.equal(error.message, STALE_WRITE_CONFLICT_MESSAGE);
});

test("filtered update is missing when the row is gone", async () => {
  const error = await resolveMissingUpdateConflict({
    expectedUpdatedAt: "2026-09-04T10:00:00.000Z",
    exists: async () => false,
  });
  assert.equal(isStaleWriteConflict(error), false);
});
