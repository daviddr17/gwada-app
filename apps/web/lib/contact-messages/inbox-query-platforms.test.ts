import assert from "node:assert/strict";
import { test } from "node:test";
import { inboxQueryPlatformsForChannels } from "./inbox-query-platforms";

const baseChannels = {
  whatsappEnabled: true,
  emailEnabled: true,
  facebookEnabled: true,
  instagramEnabled: true,
  whatsappConnected: false,
  emailConnected: false,
  facebookConnected: false,
  instagramConnected: false,
  staffInviteEmailAvailable: false,
};

test("inbox query platforms use enabled flags, not live connected", () => {
  const platforms = inboxQueryPlatformsForChannels(baseChannels);
  assert.deepEqual(platforms, ["gwada", "whatsapp", "email", "facebook", "instagram"]);
});

test("inbox query platforms honor explicit platform filter", () => {
  const platforms = inboxQueryPlatformsForChannels(baseChannels, "whatsapp");
  assert.deepEqual(platforms, ["whatsapp"]);
});

test("inbox query platforms skip disabled channels", () => {
  const platforms = inboxQueryPlatformsForChannels({
    ...baseChannels,
    whatsappEnabled: false,
    emailEnabled: false,
  });
  assert.deepEqual(platforms, ["gwada", "facebook", "instagram"]);
});
