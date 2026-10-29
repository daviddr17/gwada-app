import assert from "node:assert/strict";
import { test } from "node:test";
import {
  autopilotCaptionSupportsVision,
  buildAutopilotCaptionSystemPrompt,
  buildAutopilotCaptionUserPrompt,
  pickAutopilotVisionImageUrls,
} from "./social-autopilot-caption-prompt";
import { defaultSocialBrandKit } from "./social-brand-kit";

test("system prompt grounds image over conflicting brief and bans fluff", () => {
  const prompt = buildAutopilotCaptionSystemPrompt("Zur Schlagd");
  assert.match(prompt, /BILD IST WAHRHEIT/i);
  assert.match(prompt, /Konflikt Brief/i);
  assert.match(prompt, /viele Überraschungen/);
  assert.match(prompt, /Brand Kit/i);
  assert.match(prompt, /Gastronomie/i);
});

test("user prompt marks vision and keeps brand voice fields", () => {
  const kit = defaultSocialBrandKit("r1");
  kit.voiceNotes = "duzen, kurz, kein Agenturton";
  kit.doNot = "kein Halloween ohne Foto";
  kit.cta = "Tisch reservieren";
  const text = buildAutopilotCaptionUserPrompt({
    kit,
    restaurantName: "Zur Schlagd",
    withVisionImages: true,
    jobs: [
      {
        index: 0,
        slotKind: "ambient",
        title: "Terrasse",
        imageLabel: "Sommerterrasse am Fluss",
        imageUrl: "https://example.com/photo.jpg",
        facts: {
          userBrief: "Halloweenparty",
          imageCaption: "Sommerterrasse am Fluss",
        },
        templateCaption: "Licht über dem Wasser.",
      },
    ],
  });
  assert.match(text, /Foto/);
  assert.match(text, /userBriefSecondary/);
  assert.match(text, /duzen, kurz/);
  assert.match(text, /Halloweenparty/);
  assert.match(text, /Sommerterrasse/);
});

test("vision support for gpt-4o, not default grok mini", () => {
  assert.equal(
    autopilotCaptionSupportsVision({
      provider: "openai",
      model: "gpt-4o-mini",
    }),
    true,
  );
  assert.equal(
    autopilotCaptionSupportsVision({
      provider: "grok",
      model: "grok-3-mini",
    }),
    false,
  );
});

test("picks at most one https image url", () => {
  const urls = pickAutopilotVisionImageUrls(
    [
      {
        index: 0,
        slotKind: "ambient",
        title: null,
        imageLabel: null,
        imageUrl: "https://cdn.example/a.jpg",
        facts: {},
        templateCaption: "x",
      },
      {
        index: 1,
        slotKind: "ambient",
        title: null,
        imageLabel: null,
        imageUrl: "https://cdn.example/b.jpg",
        facts: {},
        templateCaption: "y",
      },
    ],
    1,
  );
  assert.deepEqual(urls, ["https://cdn.example/a.jpg"]);
});
