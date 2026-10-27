import assert from "node:assert/strict";
import { test } from "node:test";
import {
  heuristicIdeaPitch,
  parseAutopilotIdeaPitchResponse,
} from "./social-autopilot-ideas-pitch";
import type { SocialBrandKit } from "./social-brand-kit";

const kit = {
  tone: "warm",
  voiceNotes: "Herzlich und klar",
  cta: "Reservieren",
  hashtags: ["#test"],
} as SocialBrandKit;

test("parseAutopilotIdeaPitchResponse keeps valid rows and formats", () => {
  const raw = `\`\`\`json
[
  {"id":"menu:1","theme":"Schnitzel-Abend","captionDirection":"Appetit wecken, warm einladen.","suggestedFormat":"portrait_4x5"},
  {"id":"menu:2","theme":"x","captionDirection":"kurz"},
  {"id":"gallery:9","theme":"Abendlicht","captionDirection":"Atmosphäre ohne Spekulation.","suggestedFormat":"nope"}
]
\`\`\``;
  const parsed = parseAutopilotIdeaPitchResponse(raw, [
    "menu:1",
    "menu:2",
    "gallery:9",
  ]);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0]?.id, "menu:1");
  assert.equal(parsed[0]?.suggestedFormat, "portrait_4x5");
  assert.equal(parsed[1]?.id, "gallery:9");
  assert.equal(parsed[1]?.suggestedFormat, "portrait_4x5");
});

test("heuristicIdeaPitch yields theme and direction per slot", () => {
  const dish = heuristicIdeaPitch(
    {
      id: "menu:a",
      slotKind: "menu_dish",
      title: "Wiener Schnitzel",
      reasonDetail: "Wiener Schnitzel",
      imageLabel: "Wiener Schnitzel",
      dishDescription: "Mit Kartoffelsalat",
    },
    kit,
  );
  assert.match(dish.theme, /Schnitzel/);
  assert.match(dish.captionDirection, /Gericht|warm/i);
  assert.equal(dish.suggestedFormat, "portrait_4x5");

  const brand = heuristicIdeaPitch(
    {
      id: "brand:cover",
      slotKind: "brand",
      title: "Zur Schlagd",
      reasonDetail: "Titelbild",
      imageLabel: "Titelbild",
    },
    kit,
  );
  assert.ok(brand.theme.length >= 3);
  assert.equal(brand.suggestedFormat, "square_1x1");
});
