/** Horizontale Chip-Leiste: nur scrollen, wenn der Tab abgeschnitten ist (kein Zentrieren). */
export function scrollCategoryTabIntoView(
  scroller: HTMLElement,
  tabWrap: HTMLElement,
  options?: { behavior?: ScrollBehavior; padding?: number },
): void {
  const padding = options?.padding ?? 8;
  const behavior = options?.behavior ?? "smooth";
  const tabLeft = tabWrap.offsetLeft;
  const tabWidth = tabWrap.offsetWidth;
  const { scrollLeft, clientWidth, scrollWidth } = scroller;
  const maxScroll = Math.max(0, scrollWidth - clientWidth);

  if (tabLeft <= padding && scrollLeft > 0) {
    scroller.scrollTo({ left: 0, behavior });
    return;
  }

  let next = scrollLeft;

  if (tabLeft < scrollLeft + padding) {
    next = tabLeft - padding;
  } else if (tabLeft + tabWidth > scrollLeft + clientWidth - padding) {
    next = tabLeft + tabWidth - clientWidth + padding;
  } else {
    return;
  }

  next = Math.max(0, Math.min(maxScroll, next));
  if (Math.abs(next - scrollLeft) < 1) return;

  scroller.scrollTo({ left: next, behavior });
}
