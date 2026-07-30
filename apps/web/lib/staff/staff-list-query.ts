"use client";

import type { UseQueryOptions } from "@tanstack/react-query";
import {
  getModuleCacheGcTime,
  getModuleCacheStaleTime,
} from "@/lib/dashboard/module-data-cache-policy";
import { queryKeys } from "@/lib/query/query-keys";
import {
  fetchStaffContractsForRestaurant,
  fetchStaffForRestaurant,
} from "@/lib/supabase/staff-db";
import type {
  RestaurantStaffContractRow,
  RestaurantStaffRow,
} from "@/lib/types/staff";
import {
  peekStaffListCache,
  writeStaffListCache,
} from "@/lib/staff/staff-list-client-cache";
import { ensureRestaurantOwnerStaffClient } from "@/lib/staff/ensure-owner-staff-client";

export type StaffListQueryData = {
  rows: RestaurantStaffRow[];
  contracts: RestaurantStaffContractRow[];
};

export async function fetchStaffListForRestaurant(
  restaurantId: string,
): Promise<StaffListQueryData> {
  // Ensure parallel zu den Listen — nicht als Wasserfall davor.
  const [staffRes, contractsRes] = await Promise.all([
    fetchStaffForRestaurant(restaurantId),
    fetchStaffContractsForRestaurant(restaurantId),
    ensureRestaurantOwnerStaffClient(restaurantId),
  ]);
  if (staffRes.error) throw new Error(staffRes.error);
  if (contractsRes.error) throw new Error(contractsRes.error);
  const data = { rows: staffRes.data, contracts: contractsRes.data };
  writeStaffListCache(restaurantId, data);
  return data;
}

export function staffListQueryOptions(
  restaurantId: string,
): UseQueryOptions<StaffListQueryData> {
  return {
    queryKey: queryKeys.staff.list(restaurantId),
    queryFn: () => fetchStaffListForRestaurant(restaurantId),
    staleTime: getModuleCacheStaleTime("staffLive") ?? 30_000,
    gcTime: getModuleCacheGcTime("staffLive") ?? 5 * 60_000,
  };
}

export function peekStaffListQueryPlaceholder(
  restaurantId: string,
): StaffListQueryData | undefined {
  const cached = peekStaffListCache(restaurantId);
  if (!cached) return undefined;
  return { rows: cached.rows, contracts: cached.contracts };
}
