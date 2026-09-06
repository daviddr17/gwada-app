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

/**
 * Stream-Publish: angeforderte Widgets, die in diesem Fetch noch nicht
 * angekommen sind, nicht aus Placeholder/Alt-Cache stehen lassen.
 * Sonst blitzen z. B. „1 offene Aufgabe“ für Sekunden, bis checklists nachzieht.
 */
export function mergeDashboardBatchStreamPublish(args: {
  existing:
    | {
        data: DashboardBatchSummary;
        errors: DashboardBatchSummaryErrors;
      }
    | undefined;
  streamAcc: {
    data: DashboardBatchSummary;
    errors: DashboardBatchSummaryErrors;
  };
  requestedWidgets: readonly DashboardBatchWidgetId[];
}): {
  data: DashboardBatchSummary;
  errors: DashboardBatchSummaryErrors;
} {
  const data: DashboardBatchSummary = { ...(args.existing?.data ?? {}) };
  const errors: DashboardBatchSummaryErrors = {
    ...(args.existing?.errors ?? {}),
  };

  for (const widget of args.requestedWidgets) {
    if (Object.prototype.hasOwnProperty.call(args.streamAcc.data, widget)) {
      (data as Record<string, unknown>)[widget] = (
        args.streamAcc.data as Record<string, unknown>
      )[widget];
    } else {
      delete (data as Record<string, unknown>)[widget];
    }
    if (Object.prototype.hasOwnProperty.call(args.streamAcc.errors, widget)) {
      errors[widget] = args.streamAcc.errors[widget];
    } else {
      delete errors[widget];
    }
  }

  return { data, errors };
}
