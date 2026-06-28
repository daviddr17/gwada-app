import type { PaginatedListResult } from "@/lib/constants/list-pagination";
import type {
  ChecklistProtocolDeviationFilter,
  ChecklistProtocolEntry,
  ChecklistProtocolKindFilter,
  ChecklistProtocolPeriodFilter,
  ChecklistProtocolSortKey,
} from "@/lib/checklisten/checklist-protocol-entries";

export type FetchChecklistProtocolPageParams = {
  restaurantId: string;
  page: number;
  search: string;
  kind: ChecklistProtocolKindFilter;
  period: ChecklistProtocolPeriodFilter;
  areaId: string;
  deviceId: string;
  deviation: ChecklistProtocolDeviationFilter;
  sortKey: ChecklistProtocolSortKey;
  timeZone: string;
};

export async function fetchChecklistProtocolPage(
  params: FetchChecklistProtocolPageParams,
): Promise<PaginatedListResult<ChecklistProtocolEntry>> {
  const qs = new URLSearchParams({
    restaurant_id: params.restaurantId,
    page: String(params.page),
    search: params.search,
    kind: params.kind,
    period: params.period,
    area_id: params.areaId,
    device_id: params.deviceId,
    deviation: params.deviation,
    sort: params.sortKey,
    time_zone: params.timeZone,
  });

  const res = await fetch(`/api/checklisten/protocol?${qs.toString()}`, {
    credentials: "same-origin",
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "load_failed");
  }
  return (await res.json()) as PaginatedListResult<ChecklistProtocolEntry>;
}
