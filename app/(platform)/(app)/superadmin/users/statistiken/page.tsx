"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { SuperadminStatsSkeleton } from "@/components/superadmin/superadmin-stats-skeleton";
import { SuperadminUserStats } from "@/components/superadmin/superadmin-user-stats";
import {
  fetchSuperadminUsers,
  type SuperadminUserRow,
} from "@/lib/supabase/platform-superadmin-db";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";

export default function SuperadminUsersStatistikenPage() {
  const [rows, setRows] = useState<SuperadminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDeferredSkeleton(loading);

  const load = useCallback(async () => {
    setLoading(true);
    const sb = createSupabaseBrowserClient();
    const { rows: data, error } = await fetchSuperadminUsers(sb);
    if (error) toast.error(error);
    setRows(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6 pt-2">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Statistiken</h2>
        <p className="text-sm text-muted-foreground">
          Registrierungen, Aktivität und Verteilungen aller User — Stand aus
          der Live-Datenbank.
        </p>
      </div>

      {showSkeleton ? (
        <SuperadminStatsSkeleton />
      ) : loading ? (
        <div className="min-h-[24rem]" aria-busy="true" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Noch keine User-Daten für Auswertungen vorhanden.
        </p>
      ) : (
        <SuperadminUserStats rows={rows} />
      )}
    </div>
  );
}
