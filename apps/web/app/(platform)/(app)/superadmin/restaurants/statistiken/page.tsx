"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { SuperadminRestaurantStats } from "@/components/superadmin/superadmin-restaurant-stats";
import { SuperadminStatsSkeleton } from "@/components/superadmin/superadmin-stats-skeleton";
import {
  fetchSuperadminRestaurants,
  type SuperadminRestaurantRow,
} from "@/lib/supabase/platform-superadmin-db";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";

export default function SuperadminRestaurantsStatistikenPage() {
  const [rows, setRows] = useState<SuperadminRestaurantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDeferredSkeleton(loading);

  const load = useCallback(async () => {
    setLoading(true);
    const sb = createSupabaseBrowserClient();
    const { rows: data, error } = await fetchSuperadminRestaurants(sb);
    if (error) toast.error(error);
    setRows(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6 pt-2">
      <p className="text-sm text-muted-foreground">
        Wachstum, Veröffentlichungsstatus und Teamgrößen aller Restaurants.
      </p>

      {showSkeleton ? (
        <SuperadminStatsSkeleton />
      ) : loading ? (
        <div className="min-h-[24rem]" aria-busy="true" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Noch keine Restaurant-Daten für Auswertungen vorhanden.
        </p>
      ) : (
        <SuperadminRestaurantStats rows={rows} />
      )}
    </div>
  );
}
