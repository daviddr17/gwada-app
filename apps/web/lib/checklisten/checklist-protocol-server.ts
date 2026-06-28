import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CHECKLIST_PROTOCOL_DEFAULT_KIND,
  CHECKLIST_PROTOCOL_DEFAULT_PERIOD,
  getChecklistProtocolPeriodSinceIso,
  mapCaptureLogToChecklistProtocolEntry,
  mapTodoLogToChecklistProtocolEntry,
  type ChecklistProtocolDeviationFilter,
  type ChecklistProtocolEntry,
  type ChecklistProtocolKindFilter,
  type ChecklistProtocolPeriodFilter,
  type ChecklistProtocolSortKey,
} from "@/lib/checklisten/checklist-protocol-entries";
import type { PaginatedListResult } from "@/lib/constants/list-pagination";
import {
  listStaffTodoCaptureLogsProtocolPage,
  listStaffTodoLogsProtocolPage,
} from "@/lib/supabase/staff-todos-db";

export type ChecklistProtocolListQuery = {
  page?: number;
  pageSize?: number;
  search?: string;
  kind?: ChecklistProtocolKindFilter;
  period?: ChecklistProtocolPeriodFilter;
  areaId?: string;
  deviceId?: string;
  deviation?: ChecklistProtocolDeviationFilter;
  sortKey?: ChecklistProtocolSortKey;
  timeZone?: string;
};

export async function listChecklistProtocolPage(
  sb: SupabaseClient,
  restaurantId: string,
  query: ChecklistProtocolListQuery = {},
): Promise<PaginatedListResult<ChecklistProtocolEntry>> {
  const kind = query.kind ?? CHECKLIST_PROTOCOL_DEFAULT_KIND;
  const period = query.period ?? CHECKLIST_PROTOCOL_DEFAULT_PERIOD;
  const sinceIso = getChecklistProtocolPeriodSinceIso(
    period,
    query.timeZone ?? "Europe/Berlin",
  );

  const filters = {
    page: query.page,
    pageSize: query.pageSize,
    sinceIso,
    areaId: query.areaId ?? "all",
    deviceId: query.deviceId ?? "all",
    deviation: query.deviation ?? "all",
    sortKey: query.sortKey ?? "newest",
    search: query.search ?? "",
  };

  if (kind === "change") {
    const result = await listStaffTodoLogsProtocolPage(sb, restaurantId, filters);
    return {
      ...result,
      items: result.items.map(mapTodoLogToChecklistProtocolEntry),
    };
  }

  const result = await listStaffTodoCaptureLogsProtocolPage(
    sb,
    restaurantId,
    filters,
  );
  return {
    ...result,
    items: result.items.map(mapCaptureLogToChecklistProtocolEntry),
  };
}
