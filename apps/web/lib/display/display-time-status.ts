export type DisplayTimeSessionStatus = "off" | "working" | "on_break";

export type DisplayTimeSessionState = {
  status: DisplayTimeSessionStatus;
  clocked_in_at: string | null;
  break_started_at: string | null;
};

export const DISPLAY_TIME_SESSION_OFF: DisplayTimeSessionState = {
  status: "off",
  clocked_in_at: null,
  break_started_at: null,
};

export function displayTimeStatusLabel(status: DisplayTimeSessionStatus): string {
  switch (status) {
    case "working":
      return "In Schicht";
    case "on_break":
      return "In Pause";
    default:
      return "Nicht eingestempelt";
  }
}

export function displayTimeStatusClassName(status: DisplayTimeSessionStatus): string {
  switch (status) {
    case "working":
      return "text-emerald-600";
    case "on_break":
      return "text-amber-600";
    default:
      return "text-muted-foreground";
  }
}
