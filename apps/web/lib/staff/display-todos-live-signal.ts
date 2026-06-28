import type { StaffTodoDisplayUrgency } from "@/lib/staff/staff-todo-status";

export type DisplayTodosLiveSignal = {
  revision: string;
};

const URGENCIES: readonly StaffTodoDisplayUrgency[] = ["green", "orange", "red"];

/** Revision-Format: `{count}|{urgency}` */
export function parseDisplayTodosLiveRevision(
  revision: string,
): { badge_count: number; badge_urgency: StaffTodoDisplayUrgency } | null {
  const [countRaw, urgencyRaw] = revision.split("|");
  const badge_count = Number.parseInt(countRaw ?? "", 10);
  if (!Number.isFinite(badge_count) || badge_count < 0) return null;
  if (!URGENCIES.includes(urgencyRaw as StaffTodoDisplayUrgency)) return null;
  return {
    badge_count,
    badge_urgency: urgencyRaw as StaffTodoDisplayUrgency,
  };
}
