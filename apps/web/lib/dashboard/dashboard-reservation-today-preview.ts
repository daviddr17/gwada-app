/** Vorschau der anstehenden Reservierungen heute im Dashboard-Widget. */
export const DASHBOARD_TODAY_UPCOMING_PREVIEW_LIMIT = 5;

export function dashboardTodayUpcomingPreview<T>(rows: readonly T[]): {
  preview: T[];
  showAll: boolean;
} {
  return {
    preview: rows.slice(0, DASHBOARD_TODAY_UPCOMING_PREVIEW_LIMIT),
    showAll: rows.length > DASHBOARD_TODAY_UPCOMING_PREVIEW_LIMIT,
  };
}
