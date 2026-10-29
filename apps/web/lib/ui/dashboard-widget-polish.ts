/** Dashboard-home Apple-like polish — scoped to widget chrome, not app-wide `--shadow-card`. */

export const dashboardWidgetSoftElevationClassName =
  "rounded-2xl border-border/40 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_28px_rgba(15,23,42,0.07)] dark:border-border/50 dark:shadow-[0_1px_2px_oklch(0_0_0/20%),0_10px_28px_oklch(0_0_0/32%)]";

export const dashboardWidgetPrimaryElevationClassName =
  "rounded-2xl border-border/35 shadow-[0_2px_4px_rgba(15,23,42,0.05),0_14px_36px_rgba(15,23,42,0.09)] dark:border-border/45 dark:shadow-[0_2px_4px_oklch(0_0_0/22%),0_14px_36px_oklch(0_0_0/38%)]";

export const DASHBOARD_WIDGET_PRESS_SPRING = {
  type: "spring" as const,
  stiffness: 420,
  damping: 28,
  mass: 0.85,
};

export const DASHBOARD_WIDGET_PRESS_SCALE = 0.97;

export const DASHBOARD_METRIC_PRESS_SCALE = 0.985;
