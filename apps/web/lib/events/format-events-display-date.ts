import type { UnifiedEventItem } from "@/lib/events/unified-event-item";
import { compareFeedItemsWithPinFirst } from "@/lib/feed-pin/feed-pin-types";

export function sortEventsByStartAt(items: UnifiedEventItem[]): UnifiedEventItem[] {
  return [...items].sort((a, b) =>
    compareFeedItemsWithPinFirst(a, b, (left, right) =>
      new Date(right.startAt).getTime() - new Date(left.startAt).getTime(),
    ),
  );
}

function formatRangeTimes(
  start: Date,
  end: Date | null,
  dateFmt: Intl.DateTimeFormat,
  timeFmt: Intl.DateTimeFormat,
): string {
  const startDate = dateFmt.format(start);
  const startTime = timeFmt.format(start);
  if (!end) return `${startDate}, ${startTime}`;
  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();
  if (sameDay) {
    return `${startDate}, ${startTime} – ${timeFmt.format(end)}`;
  }
  return `${startDate}, ${startTime} – ${dateFmt.format(end)}, ${timeFmt.format(end)}`;
}

export function formatEventDateRange(item: Pick<UnifiedEventItem, "startAt" | "endAt">): string {
  const start = new Date(item.startAt);
  const end = item.endAt ? new Date(item.endAt) : null;
  const dateFmt = new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const timeFmt = new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return formatRangeTimes(start, end, dateFmt, timeFmt);
}

const timelineMonthYearFmt = new Intl.DateTimeFormat("de-DE", {
  month: "long",
  year: "numeric",
});

const timelineMonthShortFmt = new Intl.DateTimeFormat("de-DE", {
  month: "short",
});

export function formatEventTimelineMonthYear(iso: string): string {
  return timelineMonthYearFmt.format(new Date(iso));
}

export function eventTimelineSameMonthYear(leftIso: string, rightIso: string): boolean {
  const left = new Date(leftIso);
  const right = new Date(rightIso);
  return (
    left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth()
  );
}

export function formatEventTimelineDay(iso: string): string {
  return String(new Date(iso).getDate());
}

export function formatEventTimelineMonthShort(iso: string): string {
  return timelineMonthShortFmt.format(new Date(iso)).replace(/\.$/, "");
}

export function isEventPast(item: Pick<UnifiedEventItem, "startAt" | "endAt">): boolean {
  const end = item.endAt ? new Date(item.endAt) : new Date(item.startAt);
  return end.getTime() < Date.now();
}

export function formatEventCardDate(item: UnifiedEventItem): string {
  const start = new Date(item.startAt);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isToday =
    start.getFullYear() === now.getFullYear() &&
    start.getMonth() === now.getMonth() &&
    start.getDate() === now.getDate();
  const isTomorrow =
    start.getFullYear() === tomorrow.getFullYear() &&
    start.getMonth() === tomorrow.getMonth() &&
    start.getDate() === tomorrow.getDate();
  const timeFmt = new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });
  if (isToday) return `Heute, ${timeFmt.format(start)}`;
  if (isTomorrow) return `Morgen, ${timeFmt.format(start)}`;
  return formatEventDateRange(item);
}

export function buildEventAnnouncementBody(input: {
  title: string;
  description: string;
  startAt: string;
  endAt: string | null;
  ticketUrl: string | null;
  location: string | null;
}): string {
  const lines = [input.title.trim()];
  if (input.description.trim()) lines.push("", input.description.trim());
  lines.push("", `📅 ${formatEventDateRange({ startAt: input.startAt, endAt: input.endAt })}`);
  if (input.location?.trim()) lines.push(`📍 ${input.location.trim()}`);
  if (input.ticketUrl?.trim()) lines.push(`🎫 ${input.ticketUrl.trim()}`);
  return lines.join("\n");
}
