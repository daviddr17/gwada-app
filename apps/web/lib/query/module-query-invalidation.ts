"use client";

import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/query-keys";

export function invalidateMenuQueries(
  queryClient: QueryClient,
  restaurantId: string,
): void {
  void queryClient.invalidateQueries({
    queryKey: queryKeys.menu.root(restaurantId),
  });
  void queryClient.invalidateQueries({
    queryKey: queryKeys.dashboard.summaryRoot(restaurantId),
  });
}

export function invalidateInventoryQueries(
  queryClient: QueryClient,
  restaurantId: string,
  options?: { stockChanged?: boolean },
): void {
  void queryClient.invalidateQueries({
    queryKey: queryKeys.inventory.root(restaurantId),
  });
  void queryClient.invalidateQueries({
    queryKey: queryKeys.dashboard.summaryRoot(restaurantId),
  });
  if (options?.stockChanged) {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.notifications.summaryRoot(restaurantId),
    });
  }
}
