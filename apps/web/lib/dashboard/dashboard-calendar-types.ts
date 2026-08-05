export type DashboardCalendarHoursException = {
  closed: boolean;
  note: string | null;
  /** Kurzlabel z. B. „Geschlossen“ oder „11:00–14:00 · 17:00–22:00“. */
  label: string;
};

export type DashboardCalendarDaySummary = {
  /** YYYY-MM-DD (Restaurant-Kalender). */
  date: string;
  reservationCount: number;
  privateEventCount: number;
  plannedStaffCount: number;
  scheduledNewsCount: number;
  holidayName: string | null;
  hoursException: DashboardCalendarHoursException | null;
};

export type DashboardCalendarSummary = {
  /** YYYY-MM */
  month: string;
  timeZone: string;
  days: DashboardCalendarDaySummary[];
};

export function dashboardCalendarDayHasSignals(
  day: DashboardCalendarDaySummary,
): boolean {
  return (
    day.reservationCount > 0 ||
    day.privateEventCount > 0 ||
    day.plannedStaffCount > 0 ||
    day.scheduledNewsCount > 0 ||
    day.holidayName != null ||
    day.hoursException != null
  );
}
