import type { LiveActivityItem } from "./live-activity-types";

const CONFIRM_TITLE = "Reservierung bestätigt";
const NAMED_CONFIRM_MARKER = ` · ${CONFIRM_TITLE}`;

function isReservationActivity(item: LiveActivityItem): boolean {
  return item.module === "reservations_activity";
}

export function isNamelessReservationConfirmTitle(title: string): boolean {
  return title.trim() === CONFIRM_TITLE;
}

export function isNamedReservationConfirmTitle(title: string): boolean {
  return title.includes(NAMED_CONFIRM_MARKER);
}

function confirmTwinKey(item: LiveActivityItem): string | null {
  const description = item.description?.trim();
  return description ? description : null;
}

/**
 * Named staff confirm + nameless log/trigger twin share the same status line.
 * Keep the row that names who confirmed; drop only that nameless pair.
 */
export function collapseNamelessReservationConfirmTwins(
  items: readonly LiveActivityItem[],
): LiveActivityItem[] {
  const namedKeys = new Set<string>();
  for (const item of items) {
    if (!isReservationActivity(item)) continue;
    if (!isNamedReservationConfirmTitle(item.title)) continue;
    const key = confirmTwinKey(item);
    if (key) namedKeys.add(key);
  }
  if (namedKeys.size === 0) {
    return items as LiveActivityItem[];
  }

  return items.filter((item) => {
    if (!isReservationActivity(item)) return true;
    if (!isNamelessReservationConfirmTitle(item.title)) return true;
    const key = confirmTwinKey(item);
    if (!key) return true;
    return !namedKeys.has(key);
  });
}

export function shouldReplaceNamelessReservationConfirm(
  existing: Pick<LiveActivityItem, "module" | "title" | "description">,
  incoming: Pick<LiveActivityItem, "module" | "title" | "description">,
): boolean {
  if (existing.module !== "reservations_activity") return false;
  if (incoming.module !== "reservations_activity") return false;
  if (existing.description !== incoming.description) return false;
  if (!existing.description) return false;
  return (
    isNamelessReservationConfirmTitle(existing.title) &&
    isNamedReservationConfirmTitle(incoming.title)
  );
}

export function isOptimisticReservationConfirmId(id: string): boolean {
  return (
    id.startsWith("local-") ||
    id.startsWith("local:") ||
    id.startsWith("log:local-") ||
    id.startsWith("log:local:")
  );
}
