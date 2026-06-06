export function isIgnoredProfileSheetGestureTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      [
        "button",
        "a",
        "input",
        "textarea",
        "select",
        "label",
        "[role=button]",
        "[role=switch]",
        "[role=tab]",
        "[role=tablist]",
        "[data-profile-sheet-no-pull]",
      ].join(", "),
    ),
  );
}

/** Modul-Pager: Formularfläche darf swipen, nur echte Controls blockieren. */
export function isIgnoredProfileSheetModuleSwipeTarget(
  target: EventTarget | null,
) {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      [
        "button",
        "a",
        "input",
        "textarea",
        "select",
        "label",
        "[role=button]",
        "[role=switch]",
        "[role=tab]",
        "[role=tablist]",
      ].join(", "),
    ),
  );
}

/** Horizontale Chirp-Scrolls (z. B. Speisekarten-Kategorien) haben Vorrang. */
export function shouldDeferToProfileSheetHorizontalScroll(
  target: EventTarget | null,
  dx: number,
) {
  if (!(target instanceof Element)) return false;
  const scroller = target.closest("[data-profile-sheet-horizontal-scroll]");
  if (!(scroller instanceof HTMLElement)) return false;

  const { scrollLeft, scrollWidth, clientWidth } = scroller;
  if (scrollWidth <= clientWidth + 2) return false;

  if (dx < 0 && scrollLeft > 2) return true;
  if (dx > 0 && scrollLeft + clientWidth < scrollWidth - 2) return true;
  return false;
}
