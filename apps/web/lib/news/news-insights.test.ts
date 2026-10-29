import assert from "node:assert/strict";
import { test } from "node:test";
import {
  computeNewsChannelInsights,
  newsEngagementTotal,
  newsReachTotal,
  parseNewsInsights,
} from "./news-insights";
import type { UnifiedNewsItem } from "./unified-news-item";

function item(
  partial: Partial<UnifiedNewsItem> & Pick<UnifiedNewsItem, "id" | "platform">,
): UnifiedNewsItem {
  return {
    source: "external",
    postId: null,
    title: null,
    body: "Hallo",
    media: [],
    createdAt: "2026-10-01T12:00:00.000Z",
    publishedAt: "2026-10-01T12:00:00.000Z",
    scheduledAt: null,
    status: "published",
    canEdit: false,
    canDelete: false,
    externalUrl: null,
    insights: null,
    authorName: null,
    ...partial,
  };
}

test("parseNewsInsights parses numeric metrics and ignores junk", () => {
  assert.deepEqual(
    parseNewsInsights({
      likes: 3,
      comments: 1,
      reach: 40,
      views: "nope",
      shares: -1,
    }),
    { likes: 3, comments: 1, reach: 40 },
  );
  assert.equal(parseNewsInsights({}), null);
  assert.equal(parseNewsInsights(null), null);
});

test("newsReachTotal prefers reach over views", () => {
  assert.equal(newsReachTotal({ reach: 10, views: 99 }), 10);
  assert.equal(newsReachTotal({ views: 7 }), 7);
  assert.equal(newsReachTotal({ likes: 1 }), null);
});

test("newsEngagementTotal sums likes comments shares", () => {
  assert.equal(newsEngagementTotal({ likes: 2, comments: 3, shares: 1 }), 6);
  assert.equal(newsEngagementTotal({ views: 9 }), null);
});

test("computeNewsChannelInsights aggregates by platform", () => {
  const rows = computeNewsChannelInsights([
    item({
      id: "instagram:1",
      platform: "instagram",
      insights: { likes: 10, comments: 2, reach: 100 },
    }),
    item({
      id: "instagram:2",
      platform: "instagram",
      insights: { likes: 5, comments: 1 },
    }),
    item({
      id: "facebook:1",
      platform: "facebook",
      insights: { likes: 4, comments: 0, shares: 1 },
    }),
    item({
      id: "gwada:1",
      platform: "gwada",
      source: "gwada",
      postId: "p1",
      insights: null,
    }),
  ]);

  assert.equal(rows.length, 3);
  const ig = rows.find((r) => r.platform === "instagram");
  assert.equal(ig?.posts, 2);
  assert.equal(ig?.reach, 100);
  assert.equal(ig?.engagement, 18);
  const fb = rows.find((r) => r.platform === "facebook");
  assert.equal(fb?.engagement, 5);
  assert.equal(fb?.reach, null);
});
