"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { SuperadminSubscriptionStats } from "@/components/superadmin/superadmin-subscription-stats";
import { SuperadminStatsSkeleton } from "@/components/superadmin/superadmin-stats-skeleton";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  fetchSuperadminBillingInvoices,
  fetchSuperadminSubscriptions,
  type SuperadminBillingInvoiceRow,
  type SuperadminSubscriptionRow,
} from "@/lib/supabase/platform-superadmin-db";

export default function SuperadminAbonnementsStatistikenPage() {
  const [subscriptions, setSubscriptions] = useState<
    SuperadminSubscriptionRow[]
  >([]);
  const [invoices, setInvoices] = useState<SuperadminBillingInvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDeferredSkeleton(loading);

  const load = useCallback(async () => {
    setLoading(true);
    const sb = createSupabaseBrowserClient();
    const [subs, inv] = await Promise.all([
      fetchSuperadminSubscriptions(sb),
      fetchSuperadminBillingInvoices(sb),
    ]);
    if (subs.error) toast.error(subs.error);
    if (inv.error) toast.error(inv.error);
    setSubscriptions(subs.rows);
    setInvoices(inv.rows);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6 pt-2">
      <p className="text-sm text-muted-foreground">
        MRR/ARR (Katalog), Zahlungseingänge und Plan-Verteilung über alle
        Restaurants.
      </p>

      {showSkeleton ? (
        <SuperadminStatsSkeleton />
      ) : loading ? (
        <div className="min-h-[24rem]" aria-busy="true" />
      ) : subscriptions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Noch keine Abo-Daten für Auswertungen vorhanden.
        </p>
      ) : (
        <SuperadminSubscriptionStats
          subscriptions={subscriptions}
          invoices={invoices}
        />
      )}
    </div>
  );
}
