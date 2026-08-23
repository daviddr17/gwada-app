/** Height of `StaffModuleStickyBar` — published via ResizeObserver. */
export const STAFF_MODULE_STICKY_BAR_H_VAR = "--staff-module-sticky-bar-h";

/** Height of Arbeitszeiten month sticky strip — published via ResizeObserver. */
export const STAFF_WORK_HOURS_MONTH_BAR_H_VAR = "--staff-work-hours-month-bar-h";

export type StaffWorkHoursChromeContext = "staff-module" | "profile";

const STAFF_MODULE_STICKY_BAR_FALLBACK = "4.75rem";
const STAFF_WORK_HOURS_MONTH_BAR_FALLBACK = "3rem";

/** Sticky `top` for the month strip — below staff picker in Mitarbeiter, flush in Profil. */
export function staffWorkHoursMonthBarStickyTop(
  context: StaffWorkHoursChromeContext,
): string {
  if (context === "profile") return "0px";
  return `var(${STAFF_MODULE_STICKY_BAR_H_VAR}, ${STAFF_MODULE_STICKY_BAR_FALLBACK})`;
}

/** `scroll-margin-top` for day cards so „Heute“ scroll does not sit under sticky chrome. */
export function staffWorkHoursDayScrollMarginTop(
  context: StaffWorkHoursChromeContext,
): string {
  const monthBar = `var(${STAFF_WORK_HOURS_MONTH_BAR_H_VAR}, ${STAFF_WORK_HOURS_MONTH_BAR_FALLBACK})`;
  if (context === "profile") {
    return `calc(${monthBar} + 0.5rem)`;
  }
  return `calc(var(${STAFF_MODULE_STICKY_BAR_H_VAR}, ${STAFF_MODULE_STICKY_BAR_FALLBACK}) + ${monthBar} + 0.5rem)`;
}
