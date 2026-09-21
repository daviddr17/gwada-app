export type LiveActivityKind =
  | "reservation"
  | "message"
  | "notification"
  | "info";

export type LiveActivityItem = {
  id: string;
  kind: LiveActivityKind;
  /** Notification-Modul wenn bekannt (für Icon/Href). */
  module?: string;
  title: string;
  description?: string | null;
  href?: string | null;
  at: string;
};
