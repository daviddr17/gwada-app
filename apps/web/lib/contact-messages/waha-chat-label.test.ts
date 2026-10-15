import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const labelPath = path.join(process.cwd(), "lib/contact-messages/waha-chat-label.ts");
const displayPath = path.join(
  process.cwd(),
  "lib/contact-messages/waha-chat-display-name.ts",
);
const webhookPath = path.join(
  process.cwd(),
  "lib/integrations/waha-inbound-webhook.ts",
);

test("waha chat label extracts verifiedBizName for business titles", () => {
  const src = readFileSync(labelPath, "utf8");
  assert.match(src, /extractWahaBusinessDisplayName/);
  assert.match(src, /verifiedBizName/);
  assert.match(src, /lastMessage\?\.\_data/);
  assert.match(src, /needsApiResolve:\s*true/);
});

test("display-name resolve loads overview by ids and scans messages", () => {
  const src = readFileSync(displayPath, "utf8");
  assert.match(src, /wahaGetChatsOverview/);
  assert.match(src, /ids:\s*\[params\.chatId\]/);
  assert.match(src, /wahaGetChatMessages/);
  assert.match(src, /extractWahaBusinessDisplayName/);
});

test("webhook prefers verifiedBizName over pushName", () => {
  const src = readFileSync(webhookPath, "utf8");
  assert.match(src, /verifiedBizName/);
  assert.match(src, /verifiedBizName:\s*businessName/);
});
