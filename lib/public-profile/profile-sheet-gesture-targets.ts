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
        "[data-profile-app-sheet-handle]",
        "[data-profile-app-sheet-drag-chrome]",
      ].join(", "),
    ),
  );
}
