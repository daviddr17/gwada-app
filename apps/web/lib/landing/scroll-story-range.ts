/** Scroll-Progress-Bereich pro Item in einer Sticky Scroll-Story. */
export function scrollStoryItemRange(
  index: number,
  count: number,
  pad = 0.04,
): [number, number] {
  const span = (1 - pad * 2) / count;
  const start = pad + index * span;
  const end = start + span;
  return [start, end];
}

export const SCROLL_STORY_VH_PER_ITEM = 70;
