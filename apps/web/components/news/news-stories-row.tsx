"use client";

import type { UnifiedNewsStoryRing } from "@/lib/news/unified-news-story";
import { FeedStoryRingButton, feedStoryRingsRowClassName } from "@/components/feed/feed-story-ring-button";

type Props = {
  storyRings: UnifiedNewsStoryRing[];
  onRingClick: (ring: UnifiedNewsStoryRing) => void;
};

export function NewsStoriesRow({ storyRings, onRingClick }: Props) {
  if (storyRings.length === 0) return null;

  return (
    <div className={feedStoryRingsRowClassName}>
      {storyRings.map((ring) => (
        <FeedStoryRingButton
          key={ring.id}
          coverUrl={ring.coverUrl}
          title={ring.title}
          onClick={() => onRingClick(ring)}
        />
      ))}
    </div>
  );
}
