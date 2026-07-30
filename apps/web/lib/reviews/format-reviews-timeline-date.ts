const timelineMonthYearFmt = new Intl.DateTimeFormat("de-DE", {
  month: "long",
  year: "numeric",
});

const timelineMonthShortFmt = new Intl.DateTimeFormat("de-DE", {
  month: "short",
});

export function formatReviewTimelineMonthYear(iso: string): string {
  return timelineMonthYearFmt.format(new Date(iso));
}

export function reviewTimelineSameMonthYear(
  leftIso: string,
  rightIso: string,
): boolean {
  const left = new Date(leftIso);
  const right = new Date(rightIso);
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth()
  );
}

export function formatReviewTimelineDay(iso: string): string {
  return String(new Date(iso).getDate());
}

export function formatReviewTimelineMonthShort(iso: string): string {
  return timelineMonthShortFmt.format(new Date(iso)).replace(/\.$/, "");
}

export function formatReviewTimelineTimeLabel(
  iso: string,
  locale = "de-DE",
): string {
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}
