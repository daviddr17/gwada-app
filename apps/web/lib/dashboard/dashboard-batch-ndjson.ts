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
 * Stream-Publish: fertige Widget-Zeilen auf den bestehenden Stand mergen.
 * Widgets ohne Zeile in diesem Fetch bleiben stehen (stale-while-revalidate).
 * Sonst löscht die erste NDJSON-Zeile alle anderen KPIs → Skeleton-Flash.
 *
 * Checklisten-Startflash („1 offen“ aus Disk): placeholderData droppt checklists,
 * Heute wartet auf den echten Slice — nicht den ganzen Batch leeren.
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
      if (!Object.prototype.hasOwnProperty.call(args.streamAcc.errors, widget)) {
        delete errors[widget];
      }
    }
    if (Object.prototype.hasOwnProperty.call(args.streamAcc.errors, widget)) {
      errors[widget] = args.streamAcc.errors[widget];
    }
  }

  return { data, errors };
}
