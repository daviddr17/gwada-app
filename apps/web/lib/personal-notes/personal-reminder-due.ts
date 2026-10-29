import type { RestaurantPersonalNoteRow } from "@/lib/types/personal-notes";

/** Browser setTimeout safe upper bound (~24.8d). */
export const PERSONAL_REMINDER_MAX_TIMEOUT_MS = 2_147_483_647;

export type PersonalReminderPopupNote = {
  id: string;
  title: string;
  body: string | null;
  remind_at: string;
};

export function isPersonalReminderDue(
  note: Pick<
    RestaurantPersonalNoteRow,
    "remind_at" | "reminded_at" | "completed_at" | "archived_at"
  >,
  nowMs: number = Date.now(),
): boolean {
  if (note.archived_at || note.completed_at || note.reminded_at) return false;
  if (!note.remind_at) return false;
  const remindMs = new Date(note.remind_at).getTime();
  if (Number.isNaN(remindMs)) return false;
  return remindMs <= nowMs;
}

export function isPersonalReminderSchedulable(
  note: Pick<
    RestaurantPersonalNoteRow,
    "remind_at" | "reminded_at" | "completed_at" | "archived_at"
  >,
): boolean {
  if (note.archived_at || note.completed_at || note.reminded_at) return false;
  if (!note.remind_at) return false;
  const remindMs = new Date(note.remind_at).getTime();
  return !Number.isNaN(remindMs);
}

export function personalReminderPopupNotesFromRows(
  rows: RestaurantPersonalNoteRow[],
  nowMs: number = Date.now(),
): PersonalReminderPopupNote[] {
  return rows
    .filter((row) => isPersonalReminderDue(row, nowMs))
    .sort((a, b) => (a.remind_at ?? "").localeCompare(b.remind_at ?? ""))
    .map((row) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      remind_at: row.remind_at!,
    }));
}

export function nextPersonalReminderDelayMs(
  rows: RestaurantPersonalNoteRow[],
  nowMs: number = Date.now(),
): number | null {
  let soonest: number | null = null;
  for (const row of rows) {
    if (!isPersonalReminderSchedulable(row)) continue;
    const remindMs = new Date(row.remind_at!).getTime();
    if (remindMs <= nowMs) continue;
    if (soonest == null || remindMs < soonest) soonest = remindMs;
  }
  if (soonest == null) return null;
  return Math.min(
    Math.max(0, soonest - nowMs),
    PERSONAL_REMINDER_MAX_TIMEOUT_MS,
  );
}
