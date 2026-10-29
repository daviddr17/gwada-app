import assert from "node:assert/strict";
import test from "node:test";
import { defaultSocialBrandKit } from "./social-brand-kit";
import { DEFAULT_SOCIAL_FEED_PALETTE } from "./social-feed-brand-system";
import {
  previewLayoutFromBrandKit,
  previewPaletteFromBrandKit,
  sampleCaptionFromBrandKit,
} from "./social-autopilot-sample-preview";

test("sampleCaptionFromBrandKit reacts to tone, cta, hashtags, name", () => {
  const kit = defaultSocialBrandKit("00000000-0000-4000-8000-000000000001");
  kit.tone = "modern";
  kit.cta = "Tisch reservieren";
  kit.hashtags = ["berlin", "#gastro"];
  const caption = sampleCaptionFromBrandKit(kit, "Zur Schlagd");
  assert.match(caption, /Tisch reservieren/);
  assert.match(caption, /#berlin/);
  assert.match(caption, /#gastro/);
  assert.match(caption, /Zur Schlagd/);
});

test("previewLayoutFromBrandKit uses first preferred layout", () => {
  const kit = defaultSocialBrandKit("00000000-0000-4000-8000-000000000001");
  kit.preferredLayouts = ["soiree_event", "atelier_split"];
  assert.equal(previewLayoutFromBrandKit(kit), "soiree_event");
});

test("previewPaletteFromBrandKit uses restaurant accent when kit is default", () => {
  const kit = defaultSocialBrandKit("00000000-0000-4000-8000-000000000001");
  kit.feedPalette = { ...DEFAULT_SOCIAL_FEED_PALETTE };
  const palette = previewPaletteFromBrandKit(kit, "#aa3344");
  assert.equal(palette.accent.toLowerCase(), "#aa3344");
});

test("previewPaletteFromBrandKit keeps custom kit accent", () => {
  const kit = defaultSocialBrandKit("00000000-0000-4000-8000-000000000001");
  kit.feedPalette = {
    ...DEFAULT_SOCIAL_FEED_PALETTE,
    accent: "#112233",
  };
  const palette = previewPaletteFromBrandKit(kit, "#aa3344");
  assert.equal(palette.accent.toLowerCase(), "#112233");
});
