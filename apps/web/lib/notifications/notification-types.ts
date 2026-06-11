import type { NotificationModuleId } from "@/lib/notifications/notification-modules";
import type { NotificationPreferences } from "@/lib/notifications/notification-preferences";

export type NotificationItem = {
  id: string;
  title: string;
  subtitle?: string | null;
  href: string;
  at: string;
  /** Modul-spezifische Daten für mark-read (z. B. platform, contactId). */
  meta?: Record<string, string>;
};

export type NotificationModuleSummary = {
  id: NotificationModuleId;
  count: number;
  label: string;
  href: string;
  items: NotificationItem[];
};

export type NotificationSummary = {
  totalCount: number;
  modules: NotificationModuleSummary[];
  preferences: NotificationPreferences;
};
