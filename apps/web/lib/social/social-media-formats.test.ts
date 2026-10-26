import assert from "node:assert/strict";
import { test } from "node:test";
import {
  cssAspectRatioForFormat,
  publishFormatsForPlatforms,
  SOCIAL_MEDIA_FORMATS,
} from "./social-media-formats";

test("formats cover requested ratios", () => {
  assert.equal(SOCIAL_MEDIA_FORMATS.square_1x1.ratioLabel, "1:1");
  assert.equal(SOCIAL_MEDIA_FORMATS.portrait_4x5.ratioLabel, "4:5");
  assert.equal(SOCIAL_MEDIA_FORMATS.landscape_4x3.ratioLabel, "4:3");
  assert.equal(SOCIAL_MEDIA_FORMATS.classic_5x4.ratioLabel, "5:4");
  assert.equal(SOCIAL_MEDIA_FORMATS.story_9x16.ratioLabel, "9:16");
  assert.equal(cssAspectRatioForFormat("story_9x16"), "1080 / 1920");
});

test("publishFormatsForPlatforms adds story without LLM", () => {
  const withStory = publishFormatsForPlatforms({
    platforms: ["instagram", "facebook"],
    publishStories: true,
    preferredFeedFormat: "portrait_4x5",
  });
  assert.equal(withStory.feed, "portrait_4x5");
  assert.equal(withStory.story, "story_9x16");

  const noStory = publishFormatsForPlatforms({
    platforms: ["google_business"],
    publishStories: true,
  });
  assert.equal(noStory.feed, "landscape_4x3");
  assert.equal(noStory.story, null);
});
