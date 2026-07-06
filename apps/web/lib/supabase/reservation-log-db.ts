import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  clampListPage,
  clampListPageSize,
  LIST_PAGE_SIZE_DEFAULT,
  listPageRange,
  parseListPageParam,
  totalPagesFromCount,
  type PaginatedListResult,
} from "@/lib/constants/list-pagination";
import type { RestaurantReservationLogEntry } from "@/lib/types/reservation-log";
import {
  formatReservationLogActorLabel,
  formatReservationLogDetailsSummary,
} from "@/lib/types/reservation-log";

const LOG_SELECT =
  "id, restaurant_id, reservation_id, actor_user_id, action, reservation_number, guest_label, details, created_at";

function mapLogRow(r: Record<string, unknown>): RestaurantReservationLogEntry {
  return {
    id: r.id as string,
    restaurant_id: r.restaurant_id as string,
    reservation_id: (r.reservation_id as string | null) ?? null,
    actor_user_id: (r.actor_user_id as string | null) ?? null,
    action: r.action as RestaurantReservationLogEntry["action"],
    reservation_number: (r.reservation_number as number | null) ?? null,
    guest_label: r.guest_label as string,
    details: (r.details as RestaurantReservationLogEntry["details"]) ?? {},
    created_at: r.created_at as string,
  };
}

function escapeIlikePattern(value: string): string {
  return value.replace(/[%_\\]/g, "\\$&");
}

export async function fetchReservationLogEntries(
  restaurantId: string,
  reservationId?: string | null,
): Promise<{ data: RestaurantReservationLogEntry[]; error: string | null }> {
  const supabase = createSupabaseBrowserClient();
  let q = supabase
    .from("restaurant_reservation_log_entries")
    .select(LOG_SELECT)
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (reservationId) {
    q = q.eq("reservation_id", reservationId);
  }
  const { data, error } = await q;
  if (error) return { data: [], error: error.message };
  return {
    data: (data ?? []).map((r) => mapLogRow(r as Record<string, unknown>)),
    error: null,
  };
}

export async function fetchReservationLogEntriesPaginated(
  restaurantId: string,
  options?: {
    page?: number;
    pageSize?: number;
    search?: string;
    reservationId?: string | null;
  },
): Promise<PaginatedListResult<RestaurantReservationLogEntry>> {
  const supabase = createSupabaseBrowserClient();
  const pageSize = clampListPageSize(options?.pageSize ?? LIST_PAGE_SIZE_DEFAULT);
  const requestedPage = parseListPageParam(
    options?.page != null ? String(options.page) : "1",
  );
  const search = options?.search?.trim() ?? "";

  const buildQuery = (page: number) => {
    const { from, to } = listPageRange(page, pageSize);
    let q = supabase
      .from("restaurant_reservation_log_entries")
      .select(LOG_SELECT, { count: "exact" })
      .eq("restaurant_id", restaurantId)
      .order("created_at", { ascending: false })
      .range(from, to);
    if (options?.reservationId) {
      q = q.eq("reservation_id", options.reservationId);
    }
    if (search) {
      const pattern = `%${escapeIlikePattern(search)}%`;
      q = q.or(
        `guest_label.ilike.${pattern},details->>summary.ilike.${pattern}`,
      );
    }
    return q;
  };

  let page = requestedPage;
  let { data, error, count } = await buildQuery(page);
  const totalCount = count ?? 0;
  const totalPages = totalPagesFromCount(totalCount, pageSize);
  page = clampListPage(page, totalPages);

  if (page !== requestedPage) {
    ({ data, error, count } = await buildQuery(page));
  }

  if (error) {
    return {
      items: [],
      page: 1,
      pageSize,
      totalCount: 0,
      totalPages: 1,
    };
  }

  return {
    items: (data ?? []).map((r) => mapLogRow(r as Record<string, unknown>)),
    page,
    pageSize,
    totalCount: count ?? totalCount,
    totalPages,
  };
}

export function resolveReservationLogEntryActorLabel(
  entry: RestaurantReservationLogEntry,
): string {
  return formatReservationLogActorLabel(entry.details);
}

export function resolveReservationLogEntryDetailsSummary(
  entry: RestaurantReservationLogEntry,
): string {
  return formatReservationLogDetailsSummary(entry.details, entry.action);
}
