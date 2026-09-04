"use client";

import { dispatchContactsDataRefresh } from "@/lib/contacts/contacts-live-events";
import { useRestaurantTablesLiveRefresh } from "@/lib/hooks/use-restaurant-tables-live-refresh";

export function useRestaurantContactsRealtime() {
  useRestaurantTablesLiveRefresh({
    tables: ["contacts"],
    channelPrefix: "contacts-live",
    onRefresh: dispatchContactsDataRefresh,
  });
}
