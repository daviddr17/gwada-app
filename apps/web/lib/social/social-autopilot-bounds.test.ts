import assert from "node:assert/strict";
import { test } from "node:test";
import {
  clampAutopilotItemCount,
  parseAutopilotCaptionResponse,
  SOCIAL_AUTOPILOT_MAX_COMPLETION_TOKENS,
  SOCIAL_AUTOPILOT_MAX_ITEMS_PER_RUN,
  SOCIAL_AUTOPILOT_MAX_LLM_CALLS,
} from "./social-autopilot-bounds";

test("autopilot caps stay hard-bounded", () => {
  assert.equal(SOCIAL_AUTOPILOT_MAX_ITEMS_PER_RUN, 7);
  assert.equal(SOCIAL_AUTOPILOT_MAX_LLM_CALLS, 1);
  assert.equal(SOCIAL_AUTOPILOT_MAX_COMPLETION_TOKENS, 1200);
  assert.equal(clampAutopilotItemCount(99), 7);
  assert.equal(clampAutopilotItemCount(3), 3);
  assert.equal(clampAutopilotItemCount(0), 0);
  assert.equal(clampAutopilotItemCount(-1), 0);
});

test("parseAutopilotCaptionResponse accepts fenced JSON and drops bad rows", () => {
  const raw = `\`\`\`json
[
  {"index":0,"title":"Schnitzel","caption":"Heute auf dem Teller: Wiener Schnitzel.\\nFrisch bei uns."},
  {"index":1,"title":"","caption":"kurz"},
  {"index":9,"title":"x","caption":"Diese Zeile hat einen ungültigen Index und wird verworfen."}
]
\`\`\``;
  const parsed = parseAutopilotCaptionResponse(raw, [0, 1]);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0]?.index, 0);
  assert.equal(parsed[0]?.title, "Schnitzel");
  assert.match(parsed[0]?.caption ?? "", /Schnitzel/);
});
