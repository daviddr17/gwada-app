import type { DashboardBatchWidgetId } from "@/lib/dashboard/dashboard-batch-widgets";
import {
  applyDashboardBatchNdjsonWidgetLine,
  isDashboardBatchNdjsonWidgetLine,
  type DashboardBatchNdjsonLine,
} from "@/lib/dashboard/dashboard-batch-ndjson";
import type {
  DashboardBatchSummary,
  DashboardBatchSummaryErrors,
} from "@/lib/dashboard/load-dashboard-batch-summary-server";

export type DashboardBatchSummaryClientResult = {
  data: DashboardBatchSummary | null;
  errors: DashboardBatchSummaryErrors;
  error: string | null;
};

async function fetchDashboardBatchSummaryJson(
  restaurantId: string,
  widgets: readonly DashboardBatchWidgetId[],
): Promise<DashboardBatchSummaryClientResult> {
  const params = new URLSearchParams({
    restaurantId,
    widgets: widgets.join(","),
  });
  const res = await fetch(`/api/dashboard/summary?${params}`, {
    cache: "no-store",
    credentials: "include",
  });
  const body = (await res.json()) as {
    data?: DashboardBatchSummary;
    errors?: DashboardBatchSummaryErrors;
    error?: string;
  };
  if (!res.ok) {
    return {
      data: null,
      errors: {},
      error: body.error ?? `http_${res.status}`,
    };
  }
  return {
    data: body.data ?? null,
    errors: body.errors ?? {},
    error: null,
  };
}

/**
 * NDJSON-Stream: jedes fertige Widget sofort an onPartial — Time-to-first-KPI.
 * Fallback auf JSON, wenn Stream nicht verfügbar.
 */
export async function fetchDashboardBatchSummaryClient(
  restaurantId: string,
  widgets: readonly DashboardBatchWidgetId[],
  options?: {
    stream?: boolean;
    onPartial?: (partial: {
      data: DashboardBatchSummary;
      errors: DashboardBatchSummaryErrors;
    }) => void;
  },
): Promise<DashboardBatchSummaryClientResult> {
  const onPartial = options?.onPartial;
  const wantStream = options?.stream !== false && Boolean(onPartial);

  if (!wantStream) {
    try {
      return await fetchDashboardBatchSummaryJson(restaurantId, widgets);
    } catch {
      return { data: null, errors: {}, error: "network_error" };
    }
  }

  try {
    const params = new URLSearchParams({
      restaurantId,
      widgets: widgets.join(","),
      stream: "1",
    });
    const res = await fetch(`/api/dashboard/summary?${params}`, {
      cache: "no-store",
      credentials: "include",
      headers: { Accept: "application/x-ndjson" },
    });

    if (!res.ok) {
      let error = `http_${res.status}`;
      try {
        const body = (await res.json()) as { error?: string };
        if (body.error) error = body.error;
      } catch {
        /* ignore */
      }
      return { data: null, errors: {}, error };
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("ndjson") || !res.body) {
      const body = (await res.json()) as {
        data?: DashboardBatchSummary;
        errors?: DashboardBatchSummaryErrors;
        error?: string;
      };
      if (body.data) {
        onPartial?.({ data: body.data, errors: body.errors ?? {} });
      }
      return {
        data: body.data ?? null,
        errors: body.errors ?? {},
        error: body.error ?? null,
      };
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let acc: {
      data: DashboardBatchSummary;
      errors: DashboardBatchSummaryErrors;
    } = { data: {}, errors: {} };
    let fatal: string | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const raw of lines) {
        const line = raw.trim();
        if (!line) continue;
        let parsed: DashboardBatchNdjsonLine;
        try {
          parsed = JSON.parse(line) as DashboardBatchNdjsonLine;
        } catch {
          continue;
        }
        if (isDashboardBatchNdjsonWidgetLine(parsed)) {
          acc = applyDashboardBatchNdjsonWidgetLine(acc, parsed);
          onPartial?.(acc);
          continue;
        }
        if ("done" in parsed && parsed.done) {
          if (parsed.errors) {
            acc = { ...acc, errors: { ...acc.errors, ...parsed.errors } };
          }
          if ("error" in parsed && typeof parsed.error === "string") {
            fatal = parsed.error;
          }
        }
      }
    }

    if (buffer.trim()) {
      try {
        const parsed = JSON.parse(buffer.trim()) as DashboardBatchNdjsonLine;
        if (isDashboardBatchNdjsonWidgetLine(parsed)) {
          acc = applyDashboardBatchNdjsonWidgetLine(acc, parsed);
          onPartial?.(acc);
        }
      } catch {
        /* ignore trailing junk */
      }
    }

    return {
      data: acc.data,
      errors: acc.errors,
      error: fatal,
    };
  } catch {
    return { data: null, errors: {}, error: "network_error" };
  }
}
