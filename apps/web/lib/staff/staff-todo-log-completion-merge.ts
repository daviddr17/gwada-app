/** Append-only Erfassungs-Log (Protokoll) — Status kommt aus Completions + period_start. */
export type StaffTodoCaptureLogRow = {
  todo_id: string | null;
  actor_staff_id: string | null;
  created_at: string;
  action: string;
  details: Record<string, unknown> | null;
};
