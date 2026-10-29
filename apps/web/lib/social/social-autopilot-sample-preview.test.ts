import assert from "node:assert/strict";
import test from "node:test";
import { defaultSocialBrandKit } from "./social-brand-kit";
import {
  previewLayoutFromBrandKit,
  sampleCaptionFromBrandKit,
} from "./social-autopilot-sample-preview";

test("sampleCaptionFromBrandKit reacts to tone, cta, hashtags", () => {
  const kit = defaultSocialBrandKit("00000000-0000-4000-8000-000000000001");
  kit.tone = "modern";
  kit.cta = "Tisch reservieren";
  kit.hashtags = ["berlin", "#gastro"];
  const caption = sampleCaptionFromBrandKit(kit);
  assert.match(caption, /Tisch reservieren/);
  assert.match(caption, /#berlin/);
  assert.match(caption, /#gastro/);
});

test("previewLayoutFromBrandKit uses first preferred layout", () => {
  const kit = defaultSocialBrandKit("00000000-0000-4000-8000-000000000001");
  kit.preferredLayouts = ["soiree_event", "atelier_split"];
  assert.equal(previewLayoutFromBrandKit(kit), "soiree_event");
});
