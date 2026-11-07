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

/** Framer `useScroll` offset `["start end", "end start"]` → window scrollY für Item-Mitte. */
export function scrollYForStoryItem(
  section: HTMLElement,
  index: number,
  count: number,
): number {
  const [start, end] = scrollStoryItemRange(index, count);
  const progress = (start + end) / 2;
  const sectionTop = section.getBoundingClientRect().top + window.scrollY;
  const scrollStart = sectionTop - window.innerHeight;
  const scrollEnd = sectionTop + section.offsetHeight;
  return scrollStart + progress * (scrollEnd - scrollStart);
}

export function scrollToStoryItem(
  section: HTMLElement | null,
  index: number,
  count: number,
): void {
  if (!section || count <= 0) return;
  const clamped = Math.max(0, Math.min(count - 1, index));
  const top = scrollYForStoryItem(section, clamped, count);
  window.scrollTo({ top, behavior: "smooth" });
}
