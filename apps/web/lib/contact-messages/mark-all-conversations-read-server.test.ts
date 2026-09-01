import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

/**
 * Regression: Mark-all muss die volle Inbox laden.
 * Light (`ForDashboard`, 400 Zeilen/Plattform) lässt Unreads in der DB stehen —
 * nach Remount (Live-Deploy) zeigt die Glocke wieder den vollen Unread-Stand.
 */
test("mark-all uses full unified inbox fetch, not light dashboard path", () => {
  const dir = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(
    join(dir, "mark-all-conversations-read-server.ts"),
    "utf8",
  );
  assert.match(src, /fetchUnifiedInboxConversationsServer/);
  assert.doesNotMatch(src, /fetchUnifiedInboxConversationsForDashboard/);
});

test("unread summary uses full-row path, not 400-row dashboard light fetch (PR #425)", () => {
  const dir = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(join(dir, "unread-summary-server.ts"), "utf8");
  assert.match(src, /fetchUnifiedInboxConversationsForUnreadSummary/);
  assert.doesNotMatch(src, /fetchUnifiedInboxConversationsForDashboard/);
});
