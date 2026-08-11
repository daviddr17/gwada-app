import type { DashboardBatchWidgetId } from "@/lib/dashboard/dashboard-batch-widgets";
import { isDashboardBatchWidgetId } from "@/lib/dashboard/dashboard-batch-widgets";
import type {
  DashboardBatchSummary,
  DashboardBatchSummaryErrors,
} from "@/lib/dashboard/load-dashboard-batch-summary-server";

/** Eine Zeile pro fertigem Widget (Server → Client Stream). */
export type DashboardBatchNdjsonWidgetLine = {
  w: DashboardBatchWidgetId;
  d?: unknown;
  e?: string;
};

export type DashboardBatchNdjsonDoneLine = {
  done: true;
  errors?: DashboardBatchSummaryErrors;
  error?: string;
};

export type DashboardBatchNdjsonLine =
  | DashboardBatchNdjsonWidgetLine
  | DashboardBatchNdjsonDoneLine;

export function isDashboardBatchNdjsonWidgetLine(
  line: DashboardBatchNdjsonLine,
): line is DashboardBatchNdjsonWidgetLine {
  return (
    typeof line === "object" &&
    line != null &&
    "w" in line &&
    typeof line.w === "string" &&
    isDashboardBatchWidgetId(line.w)
  );
}

export function applyDashboardBatchNdjsonWidgetLine(
  base: {
    data: DashboardBatchSummary;
    errors: DashboardBatchSummaryErrors;
  },
  line: DashboardBatchNdjsonWidgetLine,
): {
  data: DashboardBatchSummary;
  errors: DashboardBatchSummaryErrors;
} {
  if (line.e) {
    return {
      data: base.data,
      errors: { ...base.errors, [line.w]: line.e },
    };
  }
  if (line.d === undefined) return base;
  return {
    data: { ...base.data, [line.w]: line.d },
    errors: base.errors,
  };
}
