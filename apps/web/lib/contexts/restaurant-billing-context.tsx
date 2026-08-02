"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { RestaurantEntitlements } from "@/lib/billing/entitlements";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";

type RestaurantBillingContextValue = {
  entitlements: RestaurantEntitlements | null;
  loading: boolean;
  reload: () => void;
};

const RestaurantBillingContext =
  createContext<RestaurantBillingContextValue | null>(null);

export function RestaurantBillingProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { restaurantId, ready } = useWorkspaceRestaurantUuid();
  const [entitlements, setEntitlements] =
    useState<RestaurantEntitlements | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    if (!ready) return;
    if (!restaurantId) {
      setEntitlements(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void fetch(
      `/api/billing/entitlements?restaurantId=${encodeURIComponent(restaurantId)}`,
    )
      .then(async (res) => {
        const data = (await res.json()) as {
          entitlements?: RestaurantEntitlements;
        };
        if (cancelled) return;
        setEntitlements(res.ok && data.entitlements ? data.entitlements : null);
      })
      .catch(() => {
        if (!cancelled) setEntitlements(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [restaurantId, ready, tick]);

  const value = useMemo(
    () => ({ entitlements, loading, reload }),
    [entitlements, loading, reload],
  );

  return (
    <RestaurantBillingContext.Provider value={value}>
      {children}
    </RestaurantBillingContext.Provider>
  );
}

export function useRestaurantBilling(): RestaurantBillingContextValue {
  const ctx = useContext(RestaurantBillingContext);
  if (!ctx) {
    throw new Error(
      "useRestaurantBilling erfordert RestaurantBillingProvider.",
    );
  }
  return ctx;
}
