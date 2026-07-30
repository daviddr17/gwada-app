"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, Pencil } from "lucide-react";
import { toast } from "sonner";
import { SuperadminPaginatedDataTable } from "@/components/superadmin/superadmin-paginated-data-table";
import { SuperadminSearchToolbar } from "@/components/superadmin/superadmin-search-toolbar";
import { SuperadminSubscriptionEditDrawer } from "@/components/superadmin/superadmin-subscription-edit-drawer";
import {
  superadminCellNowrapClass,
  superadminDateCellClass,
} from "@/components/superadmin/superadmin-table-cells";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  billingIntervalLabel,
  billingPlanLabel,
  billingSourceLabel,
  billingStatusLabel,
  catalogMonthlyEur,
  formatEurFromCents,
} from "@/lib/billing/billing-status-labels";
import type { BillingInterval, BillingPlanId } from "@/lib/billing/plan-catalog";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  fetchSuperadminSubscriptions,
  type SuperadminSubscriptionRow,
} from "@/lib/supabase/platform-superadmin-db";

function formatDt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function planBadgeClass(planId: string): string {
  if (planId === "pro") {
    return "border-violet-500/40 bg-violet-500/10 text-violet-800 dark:text-violet-200";
  }
  if (planId === "basic") {
    return "border-sky-500/40 bg-sky-500/10 text-sky-800 dark:text-sky-200";
  }
  return "";
}

function statusBadgeClass(status: string): string {
  if (status === "active" || status === "trialing" || status === "legacy") {
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200";
  }
  if (status === "past_due" || status === "unpaid") {
    return "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200";
  }
  if (status === "canceled") {
    return "border-border/60 bg-muted/40 text-muted-foreground";
  }
  return "";
}

export function SuperadminSubscriptionsScreen() {
  const [rows, setRows] = useState<SuperadminSubscriptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [editing, setEditing] = useState<SuperadminSubscriptionRow | null>(
    null,
  );

  const load = useCallback(async () => {
    setLoading(true);
    const sb = createSupabaseBrowserClient();
    const { rows: data, error } = await fetchSuperadminSubscriptions(sb);
    if (error) toast.error(error);
    setRows(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    let list = [...rows];
    if (planFilter !== "all") {
      list = list.filter((r) => r.plan_id === planFilter);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((r) => {
        const hay = [
          r.restaurant_name,
          r.restaurant_slug,
          r.plan_id,
          r.status,
          r.source,
          r.stripe_customer_id,
          r.stripe_subscription_id,
          r.notes,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }
    return list;
  }, [rows, search, planFilter]);

  return (
    <div className="space-y-6 pt-2">
      <p className="text-sm text-muted-foreground">
        Alle Restaurant-Abos (Stripe, Legacy, Complimentary). MRR-Schätzung
        nutzt die Katalogpreise.
      </p>

      <SuperadminSearchToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Restaurant, Plan, Stripe-ID…"
        filterLabel="Plan"
        filterValue={planFilter}
        filterOptions={[
          { value: "all", label: "Alle Pläne" },
          { value: "free", label: "Free" },
          { value: "basic", label: "Basic" },
          { value: "pro", label: "Pro" },
        ]}
        onFilterChange={setPlanFilter}
      />

      <SuperadminPaginatedDataTable
        loading={loading}
        rows={filtered}
        rowKey={(r) => r.restaurant_id}
        emptyMessage="Keine Abonnements gefunden."
        itemLabel="Abos"
        resetPageKey={`${search}\0${planFilter}`}
        columns={[
          {
            id: "restaurant",
            header: "Restaurant",
            className: superadminCellNowrapClass,
            sortValue: (r) => r.restaurant_name,
            cell: (r) => (
              <div>
                <span className={`font-medium ${superadminCellNowrapClass}`}>
                  {r.restaurant_name}
                </span>
                <div className="font-mono text-xs text-muted-foreground">
                  {r.restaurant_slug}
                </div>
              </div>
            ),
          },
          {
            id: "plan",
            header: "Plan",
            sortValue: (r) => r.plan_id,
            cell: (r) => (
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge
                  variant="outline"
                  className={planBadgeClass(r.plan_id)}
                >
                  {billingPlanLabel(r.plan_id)}
                </Badge>
                {r.has_pos ? (
                  <Badge variant="outline">POS</Badge>
                ) : null}
              </div>
            ),
          },
          {
            id: "interval",
            header: "Intervall",
            sortValue: (r) => r.billing_interval,
            cell: (r) => billingIntervalLabel(r.billing_interval),
          },
          {
            id: "status",
            header: "Status",
            sortValue: (r) => r.status,
            cell: (r) => (
              <Badge variant="outline" className={statusBadgeClass(r.status)}>
                {billingStatusLabel(r.status)}
                {r.cancel_at_period_end ? " · endet" : ""}
              </Badge>
            ),
          },
          {
            id: "source",
            header: "Quelle",
            sortValue: (r) => r.source,
            cell: (r) => billingSourceLabel(r.source),
          },
          {
            id: "mrr",
            header: "MRR",
            className: "text-right tabular-nums",
            sortValue: (r) =>
              catalogMonthlyEur(
                r.plan_id as BillingPlanId,
                (r.billing_interval === "year"
                  ? "year"
                  : "month") as BillingInterval,
                r.has_pos,
                r.pos_interval === "year" ? "year" : "month",
              ),
            cell: (r) => {
              const eur = catalogMonthlyEur(
                (["free", "basic", "pro"].includes(r.plan_id)
                  ? r.plan_id
                  : "free") as BillingPlanId,
                r.billing_interval === "year" ? "year" : "month",
                r.has_pos,
                r.pos_interval === "year" ? "year" : "month",
              );
              return formatEurFromCents(Math.round(eur * 100));
            },
          },
          {
            id: "period",
            header: "Periode bis",
            className: superadminDateCellClass,
            sortValue: (r) => r.current_period_end ?? "",
            cell: (r) => (
              <span className={superadminDateCellClass}>
                {formatDt(r.current_period_end)}
              </span>
            ),
          },
          {
            id: "actions",
            header: "",
            sortValue: () => 0,
            cell: (r) => (
              <div className="flex items-center justify-end gap-1">
                {r.stripe_customer_id ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    title="Stripe-Kunde"
                    render={
                      <a
                        href={`https://dashboard.stripe.com/customers/${r.stripe_customer_id}`}
                        target="_blank"
                        rel="noreferrer"
                      />
                    }
                  >
                    <ExternalLink className="size-3.5" />
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  title="Abo bearbeiten"
                  onClick={() => setEditing(r)}
                >
                  <Pencil className="size-3.5" />
                </Button>
              </div>
            ),
          },
        ]}
      />

      <SuperadminSubscriptionEditDrawer
        row={editing}
        open={editing != null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        onSaved={() => {
          setEditing(null);
          void load();
        }}
      />
    </div>
  );
}
