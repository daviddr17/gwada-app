import "server-only";

import {
  clampListPage,
  clampListPageSize,
  listPageRange,
  totalPagesFromCount,
  type PaginatedListResult,
} from "@/lib/constants/list-pagination";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type RegisterSessionRow = {
  id: string;
  opened_at: string;
  closed_at: string | null;
  opening_cash_cents: number;
  closing_cash_cents: number | null;
  expected_cash_cents: number | null;
  cash_difference_cents: number | null;
  z_nr: number | null;
  cash_point_closing_id: string | null;
  dsfinvk_business_date: string | null;
};

export type ListClosedRegisterSessionsOptions = {
  fromClosedAt?: string;
  toClosedAtExclusive?: string;
  page?: number | null;
  pageSize?: number | null;
  /** @deprecated use page/pageSize — kept for Staff clients */
  limit?: number;
};

export async function listClosedRegisterSessions(
  restaurantId: string,
  limitOrOptions: number | ListClosedRegisterSessionsOptions = 30,
  maybeOptions?: { fromClosedAt?: string; toClosedAtExclusive?: string },
): Promise<RegisterSessionRow[]> {
  const options: ListClosedRegisterSessionsOptions =
    typeof limitOrOptions === "number"
      ? { limit: limitOrOptions, ...(maybeOptions ?? {}) }
      : limitOrOptions;

  const pageSize = options.pageSize
    ? clampListPageSize(options.pageSize)
    : Math.min(Math.max(options.limit ?? 30, 1), 500);
  const page = options.page ? Math.max(1, options.page) : 1;

  const result = await listClosedRegisterSessionsPage(restaurantId, {
    ...options,
    page,
    pageSize,
  });
  return result.items;
}

export async function listClosedRegisterSessionsPage(
  restaurantId: string,
  options: ListClosedRegisterSessionsOptions = {},
): Promise<PaginatedListResult<RegisterSessionRow>> {
  const pageSize = clampListPageSize(
    options.pageSize ?? options.limit ?? 30,
  );
  const requestedPage = Math.max(1, options.page ?? 1);
  const empty: PaginatedListResult<RegisterSessionRow> = {
    items: [],
    page: requestedPage,
    pageSize,
    totalCount: 0,
    totalPages: 1,
  };

  const admin = createSupabaseAdminClient();
  if (!admin) return empty;

  let countQuery = admin
    .from("pos_register_sessions")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId)
    .not("closed_at", "is", null);

  let dataQuery = admin
    .from("pos_register_sessions")
    .select(
      "id, opened_at, closed_at, opening_cash_cents, closing_cash_cents, expected_cash_cents, cash_difference_cents, z_nr, cash_point_closing_id, dsfinvk_business_date",
    )
    .eq("restaurant_id", restaurantId)
    .not("closed_at", "is", null)
    .order("closed_at", { ascending: false });

  if (options.fromClosedAt) {
    countQuery = countQuery.gte("closed_at", options.fromClosedAt);
    dataQuery = dataQuery.gte("closed_at", options.fromClosedAt);
  }
  if (options.toClosedAtExclusive) {
    countQuery = countQuery.lt("closed_at", options.toClosedAtExclusive);
    dataQuery = dataQuery.lt("closed_at", options.toClosedAtExclusive);
  }

  const { count, error: countError } = await countQuery;
  if (countError) {
    console.error("[pos] list register sessions count", countError.message);
    return empty;
  }

  const totalCount = count ?? 0;
  const totalPages = totalPagesFromCount(totalCount, pageSize);
  const page = clampListPage(requestedPage, totalPages);
  const { from, to } = listPageRange(page, pageSize);

  const { data, error } = await dataQuery.range(from, to);
  if (error) {
    console.error("[pos] list register sessions", error.message);
    return empty;
  }

  return {
    items: (data ?? []) as RegisterSessionRow[],
    page,
    pageSize,
    totalCount,
    totalPages,
  };
}

export async function getRegisterSessionForRestaurant(
  restaurantId: string,
  sessionId: string,
): Promise<RegisterSessionRow | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;

  const { data, error } = await admin
    .from("pos_register_sessions")
    .select(
      "id, opened_at, closed_at, opening_cash_cents, closing_cash_cents, expected_cash_cents, cash_difference_cents, z_nr, cash_point_closing_id, dsfinvk_business_date",
    )
    .eq("restaurant_id", restaurantId)
    .eq("id", sessionId)
    .maybeSingle();

  if (error || !data) return null;
  return data as RegisterSessionRow;
}
