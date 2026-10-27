import assert from "node:assert/strict";
import { test } from "node:test";
import {
  autopilotWeeklyRoom,
  collectSocialAutopilotUsedKeys,
  suggestionCountsTowardAutopilotDedupe,
} from "./social-autopilot-dedupe";
import type { SocialPostSuggestion } from "./social-suggestion-types";

function sug(
  partial: Partial<SocialPostSuggestion> &
    Pick<SocialPostSuggestion, "status" | "slotKind">,
): SocialPostSuggestion {
  return {
    id: partial.id ?? "s1",
    restaurantId: "r1",
    status: partial.status,
    slotKind: partial.slotKind,
    templateId: "brand_card",
    feedLayout: "signature_brand",
    plannedAt: partial.plannedAt ?? "2026-10-27T10:00:00.000Z",
    title: partial.title ?? null,
    caption: partial.caption ?? "",
    platforms: ["instagram"],
    source: partial.source ?? {},
    asset: partial.asset ?? { imageUrl: null, source: "none" },
    newsPostId: null,
    createdAt: partial.createdAt ?? "2026-10-27T09:00:00.000Z",
  };
}

test("pending always counts toward dedupe", () => {
  const wed = new Date("2026-10-28T12:00:00.000Z");
  assert.equal(
    suggestionCountsTowardAutopilotDedupe(
      sug({
        status: "pending",
        slotKind: "menu_dish",
        createdAt: "2020-01-01T00:00:00.000Z",
      }),
      wed,
    ),
    true,
  );
  assert.equal(
    suggestionCountsTowardAutopilotDedupe(
      sug({
        status: "needs_asset",
        slotKind: "ambient",
        createdAt: "2020-01-01T00:00:00.000Z",
      }),
      wed,
    ),
    true,
  );
});

test("approved/skipped only count in current week", () => {
  const wed = new Date("2026-10-28T12:00:00.000Z");
  assert.equal(
    suggestionCountsTowardAutopilotDedupe(
      sug({
        status: "approved",
        slotKind: "menu_dish",
        createdAt: "2026-10-27T10:00:00.000Z",
      }),
      wed,
    ),
    true,
  );
  assert.equal(
    suggestionCountsTowardAutopilotDedupe(
      sug({
        status: "skipped",
        slotKind: "menu_dish",
        createdAt: "2026-10-20T10:00:00.000Z",
      }),
      wed,
    ),
    false,
  );
});

test("collectSocialAutopilotUsedKeys tracks idea and source ids", () => {
  const used = collectSocialAutopilotUsedKeys(
    [
      sug({
        status: "pending",
        slotKind: "menu_dish",
        source: { ideaId: "menu:dish-1", dishId: "dish-1" },
        asset: { imageUrl: "x", source: "menu", sourceId: "dish-1" },
      }),
      sug({
        status: "pending",
        slotKind: "ambient",
        source: { galleryItemId: "g1" },
        asset: { imageUrl: "y", source: "gallery", sourceId: "g1" },
      }),
      sug({
        status: "pending",
        slotKind: "event",
        source: { eventId: "e1" },
        asset: { imageUrl: "z", source: "event", sourceId: "e1" },
      }),
    ],
    new Date("2026-10-28T12:00:00.000Z"),
  );
  assert.equal(used.ideaIds.has("menu:dish-1"), true);
  assert.equal(used.dishIds.has("dish-1"), true);
  assert.equal(used.galleryIds.has("g1"), true);
  assert.equal(used.eventIds.has("e1"), true);
});

test("autopilotWeeklyRoom never falls back to max when room is 0", () => {
  assert.equal(
    autopilotWeeklyRoom({
      weeklyPostTarget: 3,
      pendingOpen: 5,
      maxPerRun: 7,
    }),
    0,
  );
  assert.equal(
    autopilotWeeklyRoom({
      weeklyPostTarget: 3,
      pendingOpen: 3,
      maxPerRun: 7,
    }),
    0,
  );
  assert.equal(
    autopilotWeeklyRoom({
      weeklyPostTarget: 3,
      pendingOpen: 1,
      maxPerRun: 7,
    }),
    2,
  );
  assert.equal(
    autopilotWeeklyRoom({
      weeklyPostTarget: 10,
      pendingOpen: 0,
      maxPerRun: 7,
    }),
    7,
  );
});
