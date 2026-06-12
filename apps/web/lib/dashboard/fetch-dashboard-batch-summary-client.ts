import type { DashboardBatchWidgetId } from "@/lib/dashboard/dashboard-batch-widgets";
import type {
  DashboardBatchSummary,
  DashboardBatchSummaryErrors,
} from "@/lib/dashboard/load-dashboard-batch-summary-server";

export async function fetchDashboardBatchSummaryClient(
  restaurantId: string,
  widgets: readonly DashboardBatchWidgetId[],
): Promise<{
  data: DashboardBatchSummary | null;
  errors: DashboardBatchSummaryErrors;
  error: string | null;
}> {
  try {
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
  } catch {
    return { data: null, errors: {}, error: "network_error" };
  }
}
