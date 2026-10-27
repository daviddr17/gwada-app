import assert from "node:assert/strict";
import { test } from "node:test";
import { parseSocialAutopilotIdeaHints } from "./social-autopilot-ideas";

test("parseSocialAutopilotIdeaHints keeps theme direction format", () => {
  const hints = parseSocialAutopilotIdeaHints({
    "menu:1": {
      theme: "Schnitzel-Abend",
      captionDirection: "Warm einladen",
      suggestedFormat: "portrait_4x5",
    },
    "bad": null,
    "gallery:2": { theme: "", captionDirection: "", suggestedFormat: "nope" },
  });
  assert.deepEqual(Object.keys(hints), ["menu:1"]);
  assert.equal(hints["menu:1"]?.theme, "Schnitzel-Abend");
  assert.equal(hints["menu:1"]?.suggestedFormat, "portrait_4x5");
});
