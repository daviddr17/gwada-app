import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import path from "node:path";

const clientPath = path.join(
  process.cwd(),
  "lib/contact-messages/unified-inbox-client.ts",
);

test("unified inbox client uses server inbox API", () => {
  const src = readFileSync(clientPath, "utf8");
  assert.match(src, /\/api\/contact-messages\/inbox/);
  assert.doesNotMatch(src, /fetchContactConversations\(/);
  assert.doesNotMatch(src, /createSupabaseBrowserClient/);
});

test("inbox API route exists", () => {
  const routePath = path.join(
    process.cwd(),
    "app/api/contact-messages/inbox/route.ts",
  );
  const src = readFileSync(routePath, "utf8");
  assert.match(src, /loadInboxConversationsServer/);
});
